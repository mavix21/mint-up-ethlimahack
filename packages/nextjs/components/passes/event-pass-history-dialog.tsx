"use client";

import type { ReactNode } from "react";
import { History } from "lucide-react";

import { Button } from "~~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~~/components/ui/dialog";

export function EventPassHistoryDialog({
  eventName,
  children,
}: {
  eventName: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <History />
        Historial
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historial del pase</DialogTitle>
          <DialogDescription>{eventName}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
