import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  IDataObject,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const SIGNATURE_HEADER = 'x-asis-signature';
const SIGNATURE_TOLERANCE_SECONDS = 300;

interface RequestWithRawBody {
  rawBody?: Buffer;
}

function parseSignatureHeader(header: string): { timestamp: string; signature: string } | null {
  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signature = parts.find((part) => part.startsWith('v1='))?.slice(3);
  return timestamp && signature ? { timestamp, signature } : null;
}

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export class AsisChatTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'asis.chat Trigger',
    name: 'asisChatTrigger',
    icon: 'file:asis.svg',
    group: ['trigger'],
    version: 1,
    description: 'Start a workflow when something happens in your WhatsApp',
    defaults: { name: 'asis.chat Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName:
          'Copy the Production URL above and paste it as a webhook endpoint under Developers in asis.chat, then subscribe it to the events you want.',
        name: 'setupNotice',
        type: 'notice',
        default: '',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        default: ['message.received'],
        description: 'Only these events continue into the workflow. Everything else is acknowledged and dropped.',
        options: [
          { name: 'Conversation Assigned', value: 'conversation.assigned' },
          { name: 'Conversation Created', value: 'conversation.created' },
          { name: 'Message Received', value: 'message.received' },
          { name: 'Message Sent', value: 'message.sent' },
          { name: 'Message Status Updated', value: 'message.status.updated' },
        ],
      },
      {
        displayName: 'Verify Signature',
        name: 'verifySignature',
        type: 'boolean',
        default: true,
        description:
          'Whether to check the X-Asis-Signature header before running the workflow. Leave it on: without it anyone who learns this URL can inject fake WhatsApp events.',
      },
      {
        displayName: 'Signing Secret',
        name: 'signingSecret',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: true,
        description: 'The whsec_ secret shown next to the endpoint in asis.chat',
        displayOptions: { show: { verifySignature: [true] } },
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const request = this.getRequestObject() as unknown as RequestWithRawBody;
    const headers = this.getHeaderData() as Record<string, string | undefined>;
    const body = this.getBodyData() as { event?: string };
    const subscribedEvents = this.getNodeParameter('events', []) as string[];
    const verifySignature = this.getNodeParameter('verifySignature', true) as boolean;

    if (verifySignature) {
      const signingSecret = this.getNodeParameter('signingSecret', '') as string;
      const header = headers[SIGNATURE_HEADER];
      if (!header) {
        throw new NodeOperationError(this.getNode(), 'Missing X-Asis-Signature header', {
          description: 'The request did not come from asis.chat, or signature verification was turned off there.',
        });
      }

      const parsed = parseSignatureHeader(header);
      if (!parsed) {
        throw new NodeOperationError(this.getNode(), 'Malformed X-Asis-Signature header');
      }

      if (!request.rawBody) {
        throw new NodeOperationError(this.getNode(), 'The raw request body is not available, so the signature cannot be verified', {
          description:
            'This n8n instance did not preserve the raw body for this webhook. Turn signature verification off only if the endpoint is otherwise protected.',
        });
      }

      const ageSeconds = Math.abs(Date.now() / 1000 - Number(parsed.timestamp));
      if (!Number.isFinite(ageSeconds) || ageSeconds > SIGNATURE_TOLERANCE_SECONDS) {
        throw new NodeOperationError(this.getNode(), 'The signature timestamp is outside the accepted window', {
          description: 'A replayed delivery, or the clock of this machine is off.',
        });
      }

      const expected = createHmac('sha256', signingSecret)
        .update(`${parsed.timestamp}.${request.rawBody.toString('utf8')}`)
        .digest('hex');

      if (!signaturesMatch(expected, parsed.signature)) {
        throw new NodeOperationError(this.getNode(), 'The X-Asis-Signature header does not match the payload', {
          description: 'Check that the signing secret here is the one shown next to this endpoint in asis.chat.',
        });
      }
    }

    const eventName = body.event;
    if (eventName && subscribedEvents.length > 0 && !subscribedEvents.includes(eventName)) {
      return {};
    }

    return { workflowData: [this.helpers.returnJsonArray(body as IDataObject)] };
  }
}
