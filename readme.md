![Mint Up Event Pass banner](email-banner-v1.jpg)

# Mint Up Event Pass

Mint Up es una aplicación de pases para eventos. El estado de los Event Pass y
las reglas de pago se ejecutan en un contrato Arbitrum Stylus escrito en Rust.
El repositorio incluye el contrato, la generación de ABI, las herramientas de
despliegue, el frontend Next.js y el flujo local de Nitro.

## 🏆 Requisitos de la hackathon

| Requisito | Implementación | Evidencia |
| --- | --- | --- |
| Arbitrum como componente principal | El estado de los Event Pass y la liquidación de pagos se ejecutan en `MintUpEventPass` sobre redes compatibles con Arbitrum. | `packages/stylus/contracts/mint-up-event-pass/src/lib.rs`, `packages/nextjs/contracts/eventPassEnvironment.ts` |
| Smart contracts en Arbitrum | El proyecto soporta Nitro DevNode (`412346`) y Arbitrum Sepolia (`421614`), con un despliegue Sepolia registrado. | `packages/nextjs/utils/scaffold-stylus/supportedChains.ts`, `docs/event-pass-demo-deployment.json` |
| Arbitrum Stylus | El contrato es un `cdylib` de Rust que utiliza `stylus-sdk` y `openzeppelin-stylus`. | `packages/stylus/contracts/mint-up-event-pass/Cargo.toml`, `src/lib.rs` |
| Lógica esencial en Stylus | Compra, minting ERC-721, contabilidad USDC, reembolsos, check-in, transferencias y reventa están implementados en el contrato Stylus. | `packages/stylus/contracts/mint-up-event-pass/src/lib.rs` (`purchase`, `claim_refund`, `check_in`, `purchase_public_resale`) |
| Scaffold Stylus | El despliegue genera el registro de ABI/direcciones que consume Next.js; la configuración de red y los hooks están en las utilidades de Scaffold Stylus. | `packages/stylus/scripts/deploy.ts`, `packages/nextjs/contracts/deployedContracts.ts`, `packages/nextjs/utils/scaffold-stylus/` |

## ¿Por qué Arbitrum?

Arbitrum es el entorno de ejecución de la aplicación. La red local es un
Arbitrum Nitro DevNode con chain ID `412346` y RPC
`http://localhost:8547`. El entorno público de demostración es Arbitrum
Sepolia con chain ID `421614`.

El frontend selecciona el entorno mediante
`NEXT_PUBLIC_EVENT_PASS_ENVIRONMENT`. `eventPassEnvironment.ts` resuelve la
dirección del Event Pass y de USDC, mientras `scaffold.config.ts` selecciona la
red correspondiente. `wagmiConfig.tsx` y `wagmiConnectors.tsx` proporcionan el
transporte RPC y la conexión de wallet.

`MintUpEventPass` almacena la configuración de eventos, la propiedad de los
Event Pass, los saldos USDC protegidos, los nonces de autorización y los
listados de reventa. El código de verificación del frontend y del servidor
comprueba chain ID, direcciones y eventos emitidos usando el ABI generado.

## 🦀 ¿Por qué Stylus?

`MintUpEventPass` está escrito en Rust y compilado como contrato Arbitrum
Stylus. Ejecuta la lógica principal del producto:

- `register_event` valida ventanas de venta, cantidad máxima y metadata IPFS.
- `purchase` cobra USDC, actualiza el saldo protegido, genera el Event Pass
  ERC-721 y almacena su metadata.
- `claim_refund` y `release_funds` aplican las reglas de cancelación y
  liquidación diferida.
- `transfer_pass` usa autorizaciones EIP-712 de corta duración y `check_in`
  cambia el estado de asistencia.
- `create_public_resale_listing` y `purchase_public_resale` aplican las reglas
  de reventa y liquidan pagos del vendedor y comisiones.

Stylus no es un componente secundario o de demostración: el ciclo de vida
principal de los Event Pass está implementado en este contrato Rust. Sustituirlo
por Solidity implicaría otra implementación del producto, porque el contrato,
ABI, modelo de almacenamiento y pipeline de despliegue están construidos sobre
este crate Stylus. No se afirma aquí ninguna mejora de rendimiento o coste.

El contrato usa almacenamiento y macros de entrypoint de `stylus-sdk`, además
de las implementaciones ERC-721, metadata, EIP-712 e interfaces de OpenZeppelin
Stylus. Se compila mediante `cargo stylus build` desde
`packages/stylus/scripts/compile_event_pass.ts`.

## 🔎 Evidencia verificable

### Contrato Stylus

```text
packages/stylus/contracts/mint-up-event-pass/src/lib.rs
packages/stylus/contracts/mint-up-event-pass/src/main.rs
packages/stylus/contracts/mint-up-event-pass/Cargo.toml
packages/stylus/contracts/mint-up-event-pass/abi/IMintUpEventPass.sol
```

`lib.rs` contiene el almacenamiento `#[entrypoint]`, métodos públicos, llamadas
a USDC, integración ERC-721, eventos y tests Rust. `Cargo.toml` declara las
dependencias Stylus y OpenZeppelin Stylus.

### Configuración de Arbitrum

```text
packages/nextjs/utils/scaffold-stylus/supportedChains.ts
packages/nextjs/contracts/eventPassEnvironment.ts
packages/nextjs/scaffold.config.ts
packages/nextjs/services/web3/wagmiConfig.tsx
packages/stylus/.env.example
packages/nextjs/.env.example
```

Estos archivos contienen los chain IDs/RPC de Nitro y Sepolia, el selector de
entorno, las variables RPC y la dirección configurada de USDC.

### Despliegue y ABI

```text
packages/stylus/scripts/compile_event_pass.ts
packages/stylus/scripts/deploy_wrapper.ts
packages/stylus/scripts/deploy.ts
packages/stylus/scripts/deploy_contract.ts
packages/nextjs/contracts/deployedContracts.ts
```

`deploy.ts` despliega `mint-up-event-pass`, usa el USDC oficial de Arbitrum
Sepolia para la chain `421614` y genera el registro de ABI/direcciones usado
por el frontend.

Despliegue público registrado:

- Contrato: `0xf38c46f74ced7b5b5784b8eed24a17bfafcac12d`
- Red: Arbitrum Sepolia, chain ID `421614`
- Transacción: `0xf16ab268e147ecc407940dc08e25265ff069a574a0ecbe7765480ac80e9b5ee1`
- Explorer: `https://sepolia.arbiscan.io/address/0xf38c46f74ced7b5b5784b8eed24a17bfafcac12d`

### Integración del frontend

```text
packages/nextjs/contracts/eventPassEnvironment.ts
packages/nextjs/contracts/deployedContracts.ts
packages/nextjs/lib/event-pass-public-client.ts
packages/nextjs/lib/event-pass-purchase-server.ts
packages/nextjs/lib/event-pass-transactions.ts
packages/nextjs/components/passes/
packages/nextjs/lib/sponsored-operation-flow.ts
```

Next.js usa el ABI y las direcciones generadas para leer y verificar
transacciones y eventos de Event Pass. Convex gestiona datos de aplicación y
flujos de servidor; no es la fuente de verdad de propiedad o liquidación,
porque esos datos se verifican contra el contrato Arbitrum.

### Tests

```text
packages/stylus/contracts/mint-up-event-pass/src/lib.rs  # tests unitarios Rust
packages/stylus/scripts/local/test_event_pass.ts         # flujo E2E Nitro local
packages/stylus/scripts/__tests__/                       # validación ABI/despliegue
packages/nextjs/lib/*test.ts                             # tests frontend/servidor
packages/nextjs/components/passes/*test.tsx              # tests de UI
```

## 🏗️ Scaffold Stylus

`packages/stylus` contiene el contrato Rust y los scripts TypeScript de
compilación y despliegue. `packages/nextjs` contiene la interfaz, la
configuración wagmi, el registro generado de contratos y los hooks de Scaffold
Stylus. `deploy.ts` llama al helper de despliegue y escribe automáticamente el
ABI y las direcciones en `packages/nextjs/contracts/deployedContracts.ts`.

El entorno local del frontend usa Nitro por defecto. Para usar el despliegue
Sepolia, configura `NEXT_PUBLIC_EVENT_PASS_ENVIRONMENT=sepolia` y proporciona
`NEXT_PUBLIC_ARBITRUM_SEPOLIA_EVENT_PASS`.

## 🏛️ Arquitectura

```mermaid
flowchart TD
  User[Usuario] --> Frontend[Frontend Next.js]
  Frontend --> Wallet[Wallet / cuenta passkey]
  Wallet --> RPC[RPC Arbitrum Nitro o Arbitrum Sepolia]
  RPC --> Stylus[MintUpEventPass<br/>Rust + Arbitrum Stylus]
  Stylus --> USDC[Contrato USDC]
  Frontend -. datos y flujos de servidor .-> Convex[Despliegue Convex compartido]
```

- **Frontend:** interfaz Next.js y flujos de Event Pass en `packages/nextjs`.
- **Wallet:** conectores wagmi/RainbowKit y helpers de passkey/operaciones
  patrocinadas.
- **Arbitrum:** Nitro DevNode para desarrollo local o Arbitrum Sepolia para la
  demostración pública.
- **Contrato Stylus:** fuente autoritativa de propiedad, ciclo de vida,
  autorizaciones y liquidación de Event Pass.
- **USDC:** token de pago llamado por Stylus. En local se despliega
  `MockUsdc.sol`; Sepolia usa la dirección de Circle configurada.
- **Convex:** datos de aplicación y flujos de servidor externos configurados
  por `NEXT_PUBLIC_CONVEX_URL`; no es un despliegue de smart contract de este
  repositorio.

## 🔄 Flujo principal

1. El administrador registra un evento con `register_event`, incluyendo precio,
   cantidad, ventanas de tiempo, operador de check-in y metadata IPFS.
2. El usuario selecciona el evento en el frontend e inicia la compra. La app
   resuelve la dirección y red activa desde `eventPassEnvironment.ts`.
3. La wallet o el flujo de operación patrocinada envía la interacción al RPC
   de Arbitrum configurado.
4. `purchase` valida la venta, llama a `transferFrom` de USDC, registra el
   saldo protegido y genera el Event Pass ERC-721.
5. El contrato emite `EventPassPurchased`; la aplicación verifica el recibo,
   contrato y evento antes de mostrar el Event Pass.
6. Las acciones posteriores usan el mismo contrato Stylus para transferencias
   autorizadas, check-in, cancelación/reembolso, liberación de fondos o
   reventa.

## 📜 Smart contracts

### `MintUpEventPass`

```text
Lenguaje: Rust
Framework: Arbitrum Stylus SDK 0.9.0 + OpenZeppelin Stylus 0.3.0
Redes: Nitro DevNode (412346) y Arbitrum Sepolia (421614)
Ubicación: packages/stylus/contracts/mint-up-event-pass/src/lib.rs
```

Propósito: implementar el ciclo completo de Event Pass como colección
compatible con ERC-721, con reglas propias de movimiento, pagos y eventos.

Funciones principales: `register_event`, `purchase`, `claim_refund`,
`release_funds`, `transfer_pass`, `check_in`,
`create_public_resale_listing`, `purchase_public_resale`, `event_info`,
`pass_info` y `config`.

### `MockUsdc`

```text
Lenguaje: Solidity
Propósito: dependencia de pago solo local para el test E2E de Nitro
Ubicación: packages/stylus/scripts/local/MockUsdc.sol
```

Solo se selecciona para el chain ID `412346`; no es el token de pago de
producción.

## Configuración

### Requisitos previos

- Node.js y Yarn `3.2.3`, declarados en `package.json`.
- Rust/Cargo y `cargo-stylus`.
- Wallet y RPC de Arbitrum Sepolia para despliegues públicos.
- Docker no es necesario para el flujo local documentado.

### Instalación

```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local
cp packages/stylus/.env.example packages/stylus/.env
```

No subas secretos al repositorio. Para Sepolia configura:

```env
# packages/nextjs/.env.local
NEXT_PUBLIC_EVENT_PASS_ENVIRONMENT=sepolia
NEXT_PUBLIC_ARBITRUM_SEPOLIA_EVENT_PASS=0x...

# packages/stylus/.env
ACCOUNT_ADDRESS_SEPOLIA=0x...
RPC_URL_SEPOLIA=https://...
PRIVATE_KEY_SEPOLIA=...
EVENT_PASS_ADMINISTRATOR=0x...
EVENT_PASS_AUTHORIZATION_SIGNER=0x...
EVENT_PASS_FEE_RECIPIENT=0x...
```

### Compilar y ejecutar localmente

### Desplegar en Arbitrum Sepolia

El script rechaza redes no soportadas, usa la dirección fija de USDC Sepolia,
guarda los registros en `packages/stylus/deployments/` y regenera la definición
de contratos del frontend.

## 🧪 Testing

`cargo test` cubre autorización, restricciones ERC-721, compra/minting,
reembolsos, contabilidad protegida, check-in y reventa. `test_event_pass.ts`
ejecuta el contrato desplegado en Nitro DevNode. Las validaciones de ABI y
entorno están en `packages/stylus/scripts/__tests__/`.

## 🚀 Despliegue

```text
Red: Arbitrum Sepolia
Chain ID: 421614
Event Pass: 0xf38c46f74ced7b5b5784b8eed24a17bfafcac12d
USDC: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
Explorer: https://sepolia.arbiscan.io/address/0xf38c46f74ced7b5b5784b8eed24a17bfafcac12d
```

Estos valores provienen de `docs/event-pass-demo-deployment.json`. El registro
generado también contiene un despliegue local en chain ID `412346`; sus
direcciones pueden cambiar al reiniciar el devnode.
