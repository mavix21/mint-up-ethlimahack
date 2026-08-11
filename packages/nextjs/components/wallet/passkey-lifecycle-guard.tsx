"use client";

export function PasskeyLifecycleGuard({
  accountExists,
}: {
  accountExists: boolean;
}) {
  if (!accountExists) return null;
  return (
    <div className="mt-6 rounded-2xl border bg-card p-4 text-sm leading-6">
      <p className="font-bold">Ciclo de vida de la credencial</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          Eliminar o reemplazar esta passkey en tu navegador{" "}
          <strong className="text-foreground">no</strong> revocará al
          propietario onchain de Kernel. La cuenta inteligente seguirá
          requiriendo la credencial original que acabas de usar.
        </li>
        <li>
          Eliminar datos en Mint Up (Convex) no revoca al firmante onchain.
          Considéralo una limpieza de datos de la aplicación, no una revocación
          onchain.
        </li>
        <li>
          Crear una passkey nueva{" "}
          <strong className="text-foreground">
            no recupera la cuenta anterior
          </strong>
          . Una credencial de reemplazo generará una{" "}
          <strong className="text-foreground">dirección diferente</strong> y no
          podrá controlar la cuenta anterior con fondos.
        </li>
        <li>
          El reemplazo está bloqueado mientras la cuenta actual pueda tener
          activos, hasta que exista una rotación aprobada del firmante onchain.
        </li>
      </ul>
      <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs font-semibold text-amber-700">
        La rotación completa del firmante onchain es un requisito para
        producción, no se sustituye con la recuperación de Better Auth ni con
        una passkey nueva. Consulta el requisito de recuperación y rotación más
        abajo.
      </p>
    </div>
  );
}

export function SyncedVsDeviceBoundNotice({
  backupEligible,
}: {
  backupEligible?: boolean | null;
}) {
  return (
    <aside className="rounded-3xl bg-primary/10 p-6 text-sm leading-6">
      <p className="font-bold">Sincronizada o vinculada al dispositivo</p>
      {backupEligible === true ? (
        <p className="mt-2">
          Esta passkey está <strong>sincronizada</strong> (iCloud Keychain /
          Google Password Manager / gestor de contraseñas). Volver desde un
          dispositivo sincronizado compatible reconstruye la misma dirección de
          Kernel sin otro registro; la autenticación encuentra la credencial
          sincronizada.
        </p>
      ) : backupEligible === false ? (
        <p className="mt-2">
          Esta passkey parece estar <strong>vinculada al dispositivo</strong>.
          No aparecerá automáticamente en otro dispositivo. Mint Up no garantiza
          una recuperación entre dispositivos que el autenticador no pueda
          ofrecer. Perder esta credencial deja la cuenta inaccesible hasta que
          exista la rotación onchain.
        </p>
      ) : (
        <p className="mt-2">
          <strong>¿Vuelves desde otro dispositivo?</strong> Las passkeys
          sincronizadas podrían estar disponibles allí. Las credenciales
          vinculadas al dispositivo no se transfieren automáticamente, y crear
          un reemplazo no recupera una cuenta existente.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        El autenticador informa el estado de respaldo (backupEligible /
        backupState). Revisa el gestor de contraseñas de tu sistema operativo
        para verificar si la credencial está sincronizada.
      </p>
    </aside>
  );
}

export function RotationGateBanner() {
  return (
    <div
      data-testid="rotation-gate"
      className="mt-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
        Requisito de producción: rotación del firmante
      </p>
      <p className="mt-2 text-sm font-semibold">
        Se requiere la rotación completa del firmante onchain de Kernel antes de
        usar valor real en producción.
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        La recuperación de Better Auth y la creación de una passkey nueva{" "}
        <strong className="text-foreground">no</strong> rotan al propietario
        onchain. Una credencial nueva controla una dirección diferente. La
        rotación onchain aprobada (guardián/multifirma/recuperación social) es
        un mecanismo independiente y sigue bloqueada para cuentas con fondos.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Este aviso aparece en /wallet y después de cualquier intento de compra;
        Better Auth no sustituye este mecanismo.
      </p>
    </div>
  );
}
