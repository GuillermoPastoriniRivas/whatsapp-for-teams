import {
  ChartLine,
  Code2,
  BookOpen,
  Contact,
  CreditCard,
  Images,
  LayoutTemplate,
  Megaphone,
  MessageSquare,
  Phone,
  Settings,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import type { Translations } from "@/lib/i18n/translations"

type NavLabelKey = keyof Translations["nav"]

export interface NavItem {
  href: string
  icon: LucideIcon
  labelKey: NavLabelKey
  /** Etiqueta corta para la barra inferior de mobile, donde no entra la larga. */
  tabLabelKey?: NavLabelKey
  adminOnly?: boolean
}

/**
 * Única fuente de la navegación: de acá salen el sidebar de escritorio y la
 * barra inferior de mobile. Antes cada uno tenía su propia lista y se
 * desincronizaron — Facturación no se podía abrir desde el teléfono.
 *
 * `/notifications` queda deliberadamente afuera hasta que tenga backend: la
 * pantalla existe pero no muestra datos reales.
 */
const CONVERSATIONS: NavItem = { href: "/conversations", icon: MessageSquare, labelKey: "chats" }
const CONTACTS: NavItem = { href: "/contacts", icon: Contact, labelKey: "contacts" }
const CAMPAIGNS: NavItem = { href: "/campaigns", icon: Megaphone, labelKey: "campaigns" }
const TEMPLATES: NavItem = { href: "/templates", icon: LayoutTemplate, labelKey: "templates" }
const MEDIA: NavItem = { href: "/media", icon: Images, labelKey: "media" }
const FLOWS: NavItem = { href: "/flows", icon: Workflow, labelKey: "flows", adminOnly: true }
const PHONE_ADMIN: NavItem = {
  href: "/admin",
  icon: Phone,
  labelKey: "phoneAdmin",
  tabLabelKey: "numbers",
  adminOnly: true,
}
const ANALYTICS: NavItem = { href: "/analytics", icon: ChartLine, labelKey: "analytics", adminOnly: true }
const TEAM: NavItem = { href: "/agents", icon: Users, labelKey: "team", adminOnly: true }
const BUSINESS: NavItem = { href: "/business", icon: BookOpen, labelKey: "business", adminOnly: true }
const DEVELOPERS: NavItem = { href: "/developers", icon: Code2, labelKey: "developers", adminOnly: true }
const BILLING: NavItem = { href: "/settings/billing", icon: CreditCard, labelKey: "billing", adminOnly: true }
const SETTINGS: NavItem = { href: "/settings", icon: Settings, labelKey: "settings" }

export interface NavSection {
  titleKey: NavLabelKey
  items: NavItem[]
}

/** Agrupado por intención, no por permiso. Configuración al final: se toca una vez. */
export const NAV_SECTIONS: NavSection[] = [
  { titleKey: "sectionInbox", items: [CONVERSATIONS, CONTACTS] },
  { titleKey: "sectionMarketing", items: [TEMPLATES, CAMPAIGNS, MEDIA, FLOWS, ANALYTICS] },
  { titleKey: "sectionSetup", items: [PHONE_ADMIN, BUSINESS, TEAM, DEVELOPERS] },
]

/** Bloque anclado al pie del sidebar. */
export const NAV_BOTTOM: NavItem[] = [BILLING, SETTINGS]

/**
 * Tabs de la barra inferior en mobile: lo que se usa todos los días. El resto
 * vive detrás del botón de menú. Números es admin-only, así que un agente ve
 * tres tabs y no cuatro.
 */
const MOBILE_TABS: NavItem[] = [CONVERSATIONS, CONTACTS, PHONE_ADMIN, SETTINGS]

const MOBILE_MORE: NavItem[] = [TEMPLATES, CAMPAIGNS, MEDIA, FLOWS, ANALYTICS, BUSINESS, TEAM, DEVELOPERS, BILLING]

export function visibleItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  return items.filter((item) => !item.adminOnly || isAdmin)
}

export function mobileTabs(isAdmin: boolean): NavItem[] {
  return visibleItems(MOBILE_TABS, isAdmin)
}

export function mobileMoreItems(isAdmin: boolean): NavItem[] {
  return visibleItems(MOBILE_MORE, isAdmin)
}

/** Todas las rutas navegables, para resolver cuál gana al marcar el activo. */
export const ALL_NAV_HREFS: string[] = [
  ...NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.href)),
  ...NAV_BOTTOM.map((item) => item.href),
]

/**
 * Marca activo el ítem más específico que coincide: en `/settings/billing`
 * gana Facturación y no Ajustes, igual en mobile que en escritorio.
 */
export function isNavActive(pathname: string, href: string, all: readonly string[] = ALL_NAV_HREFS): boolean {
  const matches = (candidate: string) => pathname === candidate || pathname.startsWith(`${candidate}/`)
  if (!matches(href)) return false
  return !all.some((other) => other !== href && other.length > href.length && matches(other))
}
