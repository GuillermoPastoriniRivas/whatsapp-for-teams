/**
 * Pure domain service — no side effects.
 * Maps neighborhood names to delivery costs for Pizzaquira (Zipaquirá, Colombia).
 * Uses normalized lowercase + substring matching for fuzzy neighborhood resolution.
 */
export class DeliveryCostDomainService {
  private static readonly ZONE_MAP: Array<{ keywords: string[]; cost: number }> = [
    // $4,000 zone
    {
      keywords: [
        'algarra', 'concepcion', 'villa maria', 'san rafael', 'rincon del zipa',
        'comuneros', 'florida', 'cedarles', 'villa luz', 'america 500',
        'san juanito', 'coclies', 'altamira', 'bosques de silicia',
        'la libertad', 'las villas', 'julio caro', 'toscanas',
      ],
      cost: 4000,
    },
    // $5,200
    { keywords: ['san carlos'], cost: 5200 },
    // $5,500
    { keywords: ['parte alto', 'samaria'], cost: 5500 },
    // $7,400
    { keywords: ['argelia'], cost: 7400 },
    // $8,000
    { keywords: ['lecheria gloria'], cost: 8000 },
    // $8,500
    {
      keywords: [
        'barandillas', 'pasoancho', 'parcelacion santa isabel', 'santa isabel',
        'alcolpavis', 'el rudal', 'el recreo', 'riveras', 'club del comercio',
      ],
      cost: 8500,
    },
    // $9,000
    { keywords: ['la chapa'], cost: 9000 },
    // $10,000
    { keywords: ['portachuelo'], cost: 10000 },
    // $15,000
    {
      keywords: [
        'san miguel', 'san jorge', 'cogua', 'rodamontal',
        'zuma', 'poliagro', 'brinsa', 'cortijo',
      ],
      cost: 15000,
    },
  ];

  lookup(neighborhood: string): { cost: number | null; found: boolean } {
    const normalized = this.normalize(neighborhood);
    if (!normalized) return { cost: null, found: false };

    for (const zone of DeliveryCostDomainService.ZONE_MAP) {
      for (const keyword of zone.keywords) {
        if (normalized.includes(keyword) || keyword.includes(normalized)) {
          return { cost: zone.cost, found: true };
        }
      }
    }

    return { cost: null, found: false };
  }

  private normalize(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/\s+/g, ' ');
  }
}
