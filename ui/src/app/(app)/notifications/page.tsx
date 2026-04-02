"use client";

import { Bell, MessageSquare, UserPlus, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const mockNotifications = [
  {
    id: 1,
    icon: MessageSquare,
    title: "Nuevo mensaje",
    description: "Carlos García envió un mensaje en la conversación #1042",
    time: "Hace 5 min",
    read: false,
  },
  {
    id: 2,
    icon: UserPlus,
    title: "Nuevo contacto",
    description: "María López fue agregada a tus contactos",
    time: "Hace 20 min",
    read: false,
  },
  {
    id: 3,
    icon: AlertCircle,
    title: "Conversación sin responder",
    description: "La conversación #1038 lleva más de 30 minutos sin respuesta",
    time: "Hace 1 hora",
    read: true,
  },
  {
    id: 4,
    icon: MessageSquare,
    title: "Nuevo mensaje",
    description: "Ana Martínez envió un mensaje en la conversación #1035",
    time: "Hace 2 horas",
    read: true,
  },
  {
    id: 5,
    icon: Bell,
    title: "Recordatorio",
    description: "Tienes 3 conversaciones pendientes de seguimiento",
    time: "Hace 3 horas",
    read: true,
  },
];

export default function NotificationsPage() {
  return (
    <div className="p-4 space-y-4 pb-20">
      <h1 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="h-5 w-5" />
        Notificaciones
      </h1>

      <div className="space-y-2">
        {mockNotifications.map((n) => (
          <Card
            key={n.id}
            className={n.read ? "opacity-60" : "border-primary/30"}
          >
            <CardContent className="flex items-start gap-3 p-3">
              <n.icon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {n.time}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {n.description}
                </p>
              </div>
              {!n.read && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
