import React from "react";
import Link from "next/link";
import { Card as UICard, CardContent } from "~~/components/ui/card";

interface CardProps {
  icon: React.ReactNode;
  description: React.ReactNode;
  linkHref: string;
  linkText: string;
  isDarkMode: boolean;
}

export const Card: React.FC<CardProps> = ({ icon, description, linkHref, linkText }) => {
  return (
    <div className="h-full max-w-md text-center">
      <UICard>
        <CardContent>
          <div>{icon}</div>
          <p className="text-sm">
            {description}
            <br />
            <Link href={linkHref} className="font-semibold text-primary underline underline-offset-4">
              {linkText}
            </Link>{" "}
            tab.
          </p>
        </CardContent>
      </UICard>
    </div>
  );
};

export default Card;
