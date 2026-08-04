import React from "react";
import { Toast, ToastPosition, toast } from "react-hot-toast";
import { XMarkIcon } from "@heroicons/react/20/solid";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import { Button } from "~~/components/ui/button";
import { Card, CardContent } from "~~/components/ui/card";
import { Spinner } from "~~/components/ui/spinner";

type NotificationProps = {
  content: React.ReactNode;
  status: "success" | "info" | "loading" | "error" | "warning";
  duration?: number;
  icon?: string;
  position?: ToastPosition;
};

type NotificationOptions = {
  duration?: number;
  icon?: string;
  position?: ToastPosition;
};

const ENUM_STATUSES = {
  success: <CheckCircleIcon className="w-7 text-primary" />,
  loading: <Spinner className="size-6" />,
  error: <ExclamationCircleIcon className="w-7 text-destructive" />,
  info: <InformationCircleIcon className="w-7 text-primary" />,
  warning: <ExclamationTriangleIcon className="w-7 text-amber-500" />,
};

const DEFAULT_DURATION = 3000;
const DEFAULT_POSITION: ToastPosition = "top-center";

/**
 * Custom Notification
 */
const Notification = ({
  content,
  status,
  duration = DEFAULT_DURATION,
  icon,
  position = DEFAULT_POSITION,
}: NotificationProps) => {
  return toast.custom(
    (t: Toast) => (
      <div
        className={`relative max-w-sm transform-gpu transition-all duration-500 ease-in-out
        ${
          position.substring(0, 3) == "top"
            ? `hover:translate-y-1 ${t.visible ? "top-0" : "-top-96"}`
            : `hover:-translate-y-1 ${t.visible ? "bottom-0" : "-bottom-96"}`
        }`}
      >
        <Card size="sm">
          <CardContent>
            <div className="flex items-start justify-between gap-2">
              <div className="self-center leading-[0]">{icon ? icon : ENUM_STATUSES[status]}</div>
              <div className={`overflow-x-hidden break-words whitespace-pre-line ${icon ? "mt-1" : ""}`}>{content}</div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => toast.remove(t.id)}
                aria-label="Dismiss notification"
              >
                <XMarkIcon />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    {
      duration: status === "loading" ? Infinity : duration,
      position,
    },
  );
};

export const notification = {
  success: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "success", ...options });
  },
  info: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "info", ...options });
  },
  warning: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "warning", ...options });
  },
  error: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "error", ...options });
  },
  loading: (content: React.ReactNode, options?: NotificationOptions) => {
    return Notification({ content, status: "loading", ...options });
  },
  remove: (toastId: string) => {
    toast.remove(toastId);
  },
};
