import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Button } from "~~/components/ui/button";

type PaginationButtonProps = {
  currentPage: number;
  hasNextPage: boolean;
  setCurrentPage: (page: number) => void;
};

export const PaginationButton = ({ currentPage, hasNextPage, setCurrentPage }: PaginationButtonProps) => {
  const isPrevButtonDisabled = currentPage === 0;
  const isNextButtonDisabled = !hasNextPage;

  if (isNextButtonDisabled && isPrevButtonDisabled) return null;

  return (
    <div className="mt-5 justify-end flex gap-3 mx-5">
      <Button
        disabled={isPrevButtonDisabled}
        onClick={() => setCurrentPage(currentPage - 1)}
        data-testid="blockexplorer-prev-page"
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </Button>
      <span className="self-center font-medium text-foreground" data-testid="blockexplorer-page-label">
        Page {currentPage + 1}
      </span>
      <Button
        disabled={isNextButtonDisabled}
        onClick={() => setCurrentPage(currentPage + 1)}
        data-testid="blockexplorer-next-page"
      >
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
