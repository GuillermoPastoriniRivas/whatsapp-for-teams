import { Contact } from '../../../../domain/entities/contact.entity.js';
import { MessageTemplateComponent } from '../../../../domain/entities/message-template.entity.js';
import { CampaignVariableMapping } from '../../../../domain/entities/campaign.entity.js';
import {
  buildTemplatePayload,
  listTemplatePlaceholders,
  resolveVariables,
} from './template-variable.resolver.js';

const contact = new Contact(
  'contact-1',
  'tenant-1',
  'Guille',
  '5491122334455',
  null,
  new Date(),
  new Date(),
  'guille@example.com',
  'Pizzaquira',
  null,
  { ciudad: 'Palermo' },
);

const bodyOnlyTemplate: MessageTemplateComponent[] = [
  { type: 'BODY', text: 'Hola {{1}}, tenemos una promo en {{2}}!' },
];

describe('listTemplatePlaceholders', () => {
  it('extracts positional body placeholders', () => {
    expect(listTemplatePlaceholders(bodyOnlyTemplate)).toEqual([
      { component: 'body', position: '1' },
      { component: 'body', position: '2' },
    ]);
  });

  it('extracts header text, media link and button placeholders', () => {
    const components: MessageTemplateComponent[] = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Hola {{nombre}}' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Si' },
          { type: 'URL', text: 'Ver menú', url: 'https://asis.chat/{{1}}' },
        ],
      },
    ];
    expect(listTemplatePlaceholders(components)).toEqual([
      { component: 'header', position: 'link' },
      { component: 'body', position: 'nombre' },
      { component: 'button', index: 1, position: '1' },
    ]);
  });
});

describe('resolveVariables', () => {
  const mappings: CampaignVariableMapping[] = [
    { component: 'body', position: '1', source: 'contact_field', value: 'name' },
    { component: 'body', position: '2', source: 'contact_field', value: 'customFields.ciudad' },
  ];

  it('resolves contact fields and custom fields', () => {
    const result = resolveVariables(bodyOnlyTemplate, mappings, contact);
    expect(result).toEqual({ ok: true, variables: { 'body.1': 'Guille', 'body.2': 'Palermo' } });
  });

  it('reports missing variables when a mapping is absent', () => {
    const result = resolveVariables(bodyOnlyTemplate, [mappings[0]], contact);
    expect(result).toEqual({ ok: false, missing: ['body.2'] });
  });

  it('reports missing when the contact field is empty', () => {
    const badMappings: CampaignVariableMapping[] = [
      { component: 'body', position: '1', source: 'contact_field', value: 'name' },
      { component: 'body', position: '2', source: 'contact_field', value: 'customFields.inexistente' },
    ];
    const result = resolveVariables(bodyOnlyTemplate, badMappings, contact);
    expect(result).toEqual({ ok: false, missing: ['body.2'] });
  });

  it('resolves static values', () => {
    const staticMappings: CampaignVariableMapping[] = [
      { component: 'body', position: '1', source: 'static', value: 'Cliente' },
      { component: 'body', position: '2', source: 'static', value: '2x1' },
    ];
    const result = resolveVariables(bodyOnlyTemplate, staticMappings, contact);
    expect(result).toEqual({ ok: true, variables: { 'body.1': 'Cliente', 'body.2': '2x1' } });
  });
});

describe('buildTemplatePayload', () => {
  it('builds positional body parameters and renders the preview text', () => {
    const { components, renderedBody } = buildTemplatePayload(bodyOnlyTemplate, {
      'body.1': 'Guille',
      'body.2': 'Palermo',
    });
    expect(renderedBody).toBe('Hola Guille, tenemos una promo en Palermo!');
    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Guille' },
          { type: 'text', text: 'Palermo' },
        ],
      },
    ]);
  });

  it('adds parameter_name for named placeholders', () => {
    const named: MessageTemplateComponent[] = [{ type: 'BODY', text: 'Hola {{nombre}}' }];
    const { components } = buildTemplatePayload(named, { 'body.nombre': 'Guille' });
    expect(components[0].parameters[0]).toEqual({ type: 'text', text: 'Guille', parameter_name: 'nombre' });
  });

  it('builds media header and url button parameters', () => {
    const template: MessageTemplateComponent[] = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Promo!' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Pedir', url: 'https://asis.chat/{{1}}' }] },
    ];
    const { components } = buildTemplatePayload(template, {
      'header.link': 'https://cdn.example.com/promo.jpg',
      'button.0.1': 'pizzaquira',
    });
    expect(components).toEqual([
      { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn.example.com/promo.jpg' } }] },
      { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: 'pizzaquira' }] },
    ]);
  });

  // Meta lee los posicionales por su lugar en el array (parameters[0] = {{1}}),
  // así que si el texto los usa fuera de orden hay que reordenarlos antes de
  // mandarlos o el cliente recibe los valores cruzados.
  it('orders positional body parameters numerically, not by order of appearance', () => {
    const { components, renderedBody } = buildTemplatePayload(
      [{ type: 'BODY', text: 'Hola {{2}}, te escribe {{1}} por tu pedido.' }],
      { 'body.1': 'Asis', 'body.2': 'Ana' },
    );
    expect(components).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Asis' }, { type: 'text', text: 'Ana' }] },
    ]);
    expect(renderedBody).toBe('Hola Ana, te escribe Asis por tu pedido.');
  });

  it('orders positional header parameters numerically', () => {
    const { components } = buildTemplatePayload(
      [{ type: 'HEADER', format: 'TEXT', text: '{{2}} - {{1}}' }],
      { 'header.1': 'uno', 'header.2': 'dos' },
    );
    expect(components).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'uno' }, { type: 'text', text: 'dos' }] },
    ]);
  });

  // Los nombrados viajan con parameter_name, así que el orden es indistinto:
  // se respeta el del texto para no reordenar de gratis.
  it('keeps named parameters in the order they appear', () => {
    const { components } = buildTemplatePayload(
      [{ type: 'BODY', text: 'Hola {{nombre}}, tu pedido {{pedido}} salió.' }],
      { 'body.nombre': 'Ana', 'body.pedido': 'A-12' },
    );
    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ana', parameter_name: 'nombre' },
          { type: 'text', text: 'A-12', parameter_name: 'pedido' },
        ],
      },
    ]);
  });

  // Un header LOCATION no se resuelve con un link: son coordenadas, y viajan
  // en un parámetro `location` propio.
  describe('header LOCATION', () => {
    const components: MessageTemplateComponent[] = [
      { type: 'HEADER', format: 'LOCATION' },
      { type: 'BODY', text: 'Te esperamos.' },
    ];

    it('pide latitud y longitud, no un link', () => {
      expect(listTemplatePlaceholders(components)).toEqual([
        { component: 'header', position: 'latitude' },
        { component: 'header', position: 'longitude' },
      ]);
    });

    it('arma el parámetro de ubicación con el nombre y la dirección opcionales', () => {
      const built = buildTemplatePayload(components, {
        'header.latitude': '-34.9011',
        'header.longitude': '-56.1645',
        'header.name': 'Aloe Village',
        'header.address': 'La Paloma, Rocha',
      });
      expect(built.components).toEqual([
        {
          type: 'header',
          parameters: [
            {
              type: 'location',
              location: {
                latitude: '-34.9011',
                longitude: '-56.1645',
                name: 'Aloe Village',
                address: 'La Paloma, Rocha',
              },
            },
          ],
        },
      ]);
    });

    /**
     * Media ubicación la rechaza Meta y se pierde el mensaje entero, así que
     * sin coordenadas no se emite el componente.
     */
    it('no emite el componente si faltan las coordenadas', () => {
      expect(buildTemplatePayload(components, { 'header.name': 'Aloe Village' }).components).toEqual([]);
    });
  });

  it('emits no body component when the template has no placeholders', () => {
    const { components, renderedBody } = buildTemplatePayload([{ type: 'BODY', text: 'Hola!' }], {});
    expect(components).toEqual([]);
    expect(renderedBody).toBe('Hola!');
  });
});
