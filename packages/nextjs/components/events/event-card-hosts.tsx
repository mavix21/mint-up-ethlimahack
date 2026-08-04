"use client";

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "~~/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "~~/components/ui/popover";
import { cn } from "~~/lib/utils";
import { OptimizedAvatarImage as AvatarImage } from "./optimized-avatar-image";

interface Host {
  name: string;
  image?: string;
  href?: string;
}
interface EventCardHostsProps {
  hosts: Host[];
  maxDisplayed?: number;
  label?: string;
  className?: string;
}
const DEFAULT_MAX_DISPLAYED = 3;
function HostName({ host, className }: { host: Host; className?: string }) {
  return host.href ? (
    <a
      href={host.href}
      className={cn(
        "hover:text-muted-foreground text-foreground underline-offset-4 transition-colors hover:underline",
        className,
      )}
    >
      {host.name}
    </a>
  ) : (
    <span className={className}>{host.name}</span>
  );
}
function HiddenHostsList({ hosts }: { hosts: Host[] }) {
  return (
    <ul className="space-y-2">
      {hosts.map(host => (
        <li key={host.name} className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarImage src={host.image} alt={host.name} />
            <AvatarFallback>{host.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <HostName host={host} className="text-sm" />
        </li>
      ))}
    </ul>
  );
}
function EventCardHosts({ hosts, maxDisplayed = DEFAULT_MAX_DISPLAYED, label, className }: EventCardHostsProps) {
  if (hosts.length === 0) return null;
  const shown = hosts.slice(0, maxDisplayed);
  const hidden = hosts.slice(maxDisplayed);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <AvatarGroup>
        {shown.map(host => (
          <Avatar key={host.name} size="sm">
            <AvatarImage src={host.image} alt={host.name} />
            <AvatarFallback>{host.name.charAt(0)}</AvatarFallback>
          </Avatar>
        ))}
        {hidden.length ? (
          <Popover>
            <PopoverTrigger
              render={
                <AvatarGroupCount role="button" tabIndex={0}>
                  +{hidden.length}
                </AvatarGroupCount>
              }
            />
            <PopoverContent className="w-auto min-w-48">
              <HiddenHostsList hosts={hidden} />
            </PopoverContent>
          </Popover>
        ) : null}
      </AvatarGroup>
      <span className="text-muted-foreground text-xs">
        {label ? <span className="mr-1">{label}</span> : null}
        {shown.map((host, index) => (
          <span key={host.name}>
            {index ? ", " : null}
            <HostName host={host} />
          </span>
        ))}
      </span>
    </div>
  );
}
function EventCardHostsLine({ hosts, label, maxDisplayed = DEFAULT_MAX_DISPLAYED }: EventCardHostsProps) {
  if (hosts.length === 0) return null;
  const shown = hosts.slice(0, maxDisplayed);
  const hidden = hosts.slice(maxDisplayed);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <AvatarGroup className="-space-x-1.5">
        {shown.map(host => (
          <Avatar key={host.name} size="sm" className="size-4.5">
            <AvatarImage src={host.image} alt={host.name} />
            <AvatarFallback>{host.name.charAt(0)}</AvatarFallback>
          </Avatar>
        ))}
        {hidden.length ? (
          <Popover>
            <PopoverTrigger
              render={
                <AvatarGroupCount className="size-4.5 text-[9px]" role="button" tabIndex={0}>
                  +{hidden.length}
                </AvatarGroupCount>
              }
            />
            <PopoverContent className="w-auto min-w-48">
              <HiddenHostsList hosts={hidden} />
            </PopoverContent>
          </Popover>
        ) : null}
      </AvatarGroup>
      <p className="text-muted-foreground line-clamp-1 min-w-0 text-xs">
        {label ? <span className="mr-1">{label}</span> : null}
        {shown.map((host, index) => (
          <span key={host.name}>
            {index ? ", " : null}
            <HostName host={host} />
          </span>
        ))}
        {hidden.length ? ` +${hidden.length}` : null}
      </p>
    </div>
  );
}
export { EventCardHosts, EventCardHostsLine };
export type { EventCardHostsProps, Host };
