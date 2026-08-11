import { InformationCircleIcon } from "@heroicons/react/20/solid";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~~/components/ui/tooltip";

export const InheritanceTooltip = ({
  inheritedFrom,
}: {
  inheritedFrom?: string;
}) => (
  <>
    {inheritedFrom && (
      <Tooltip>
        <TooltipTrigger render={<span className="px-2 md:break-normal" />}>
          <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{`Heredado de: ${inheritedFrom}`}</TooltipContent>
      </Tooltip>
    )}
  </>
);
