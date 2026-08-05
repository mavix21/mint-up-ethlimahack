"use client";

import React, { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SwitchTheme } from "./SwitchTheme";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { Button } from "~~/components/ui/button";
import { Separator } from "~~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~~/components/ui/sheet";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { arbitrumNitro } from "~~/utils/scaffold-stylus/supportedChains";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Debug Contracts",
    href: "/debug",
    // icon: <BugAntIcon className="h-4 w-4" />,
  },
];

const HeaderMenuLinksContent = ({
  onNavigate,
}: {
  onNavigate?: () => void;
}) => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = pathname === href;

        return (
          <li key={href}>
            <Button
              render={<Link href={href} onClick={onNavigate} />}
              nativeButton={false}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
            >
              {icon}
              <span>{label}</span>
            </Button>
          </li>
        );
      })}
    </>
  );
};

export const HeaderMenuLinks = ({
  onNavigate,
}: {
  onNavigate?: () => void;
}) => (
  <Suspense fallback={null}>
    <HeaderMenuLinksContent onNavigate={onNavigate} />
  </Suspense>
);

/**
 * Site header
 */
export const Header = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork?.id === arbitrumNitro.id;

  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 px-4 py-3 lg:static">
      <div className="flex w-auto items-center lg:w-1/2">
        <Link href="/" className="flex shrink-0 items-center gap-0.5">
          <Image
            src="/logo.png"
            alt="Mint Up"
            width={56}
            height={56}
            className="size-10 md:size-12"
          />
          <span className="mt-1 font-heading text-xl font-bold md:text-2xl">
            mint up!
          </span>
        </Link>
        <div className="lg:hidden">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                />
              }
            >
              <Bars3Icon />
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="px-6">
                <ul className="flex flex-col gap-2">
                  <HeaderMenuLinks onNavigate={() => setIsDrawerOpen(false)} />
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
        <ul className="ml-6 hidden gap-2 lg:flex lg:flex-nowrap">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="mr-4 flex flex-grow items-center justify-end gap-4">
        <RainbowKitCustomConnectButton />
        <div className="h-6">
          <Separator orientation="vertical" />
        </div>
        <SwitchTheme
          className={`pointer-events-auto ${isLocalNetwork ? "self-end md:self-auto" : ""}`}
        />
      </div>
    </header>
  );
};
