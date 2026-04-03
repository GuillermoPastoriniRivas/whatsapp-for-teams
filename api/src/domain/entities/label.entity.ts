export class Label {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly color: string,
    public readonly createdAt: Date,
  ) {}
}
