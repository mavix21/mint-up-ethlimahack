import Link from "next/link";
import { Button } from "~~/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-full flex-1 items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="text-6xl font-bold m-0 mb-1">404</h1>
        <h2 className="text-2xl font-semibold m-0">Página no encontrada</h2>
        <p className="m-0 mb-4 text-muted-foreground">
          La página que buscas no existe.
        </p>
        <Button render={<Link href="/" />} nativeButton={false}>
          Ir al inicio
        </Button>
      </div>
    </div>
  );
}
