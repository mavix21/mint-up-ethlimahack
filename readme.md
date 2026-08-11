<p align="center">
  <img src="./email-banner-v1.jpg" alt="Mint Up" width="100%" />
</p>

<h1 align="center">Mint Up Passes</h1>

<p align="center">
  Entradas para eventos, diseñadas para tu seguridad. <br />
  Compra, transfiere o revende tu pase sin enfrentarte a ninguna complejidad.
</p>

<p align="center">
  <strong>Rust · Arbitrum Stylus · Next.js · TypeScript · USDC</strong>
</p>

## El proyecto

Mint Up convierte el acceso a eventos en una experiencia simple y verificable. Cada **Event Pass** es un coleccionable ERC-721 respaldado por un contrato en Arbitrum, pero el usuario no necesita seed phrases, extensiones ni conocimiento de blockchain.

El contrato protege el pago original hasta que comienza el evento, permite transferencias autorizadas entre usuarios y habilita una reventa pública con precio fijo. Si el evento se cancela, el titular actual puede recuperar el precio protegido, incluso si el pase cambió de dueño.

## ¿Por qué Stylus?

[Arbitrum Stylus](https://docs.arbitrum.io/stylus) permite escribir contratos que se ejecutan en Arbitrum usando Rust y se compilan a WebAssembly. Para Mint Up significa:

- **Seguridad y claridad de Rust** para reglas críticas de pagos, propiedad y autorización.
- **Rendimiento de WebAssembly** dentro de una red L2 rápida y de bajo costo.
- **Interoperabilidad EVM**: el Event Pass sigue siendo compatible con ERC-721, wallets e indexadores.
- **Desarrollo práctico**: Rust en el contrato y TypeScript en la aplicación, con ABI generada automáticamente.

Stylus nos permite construir una experiencia familiar para el público sin renunciar a las garantías de una aplicación on-chain.

## Arquitectura

- `packages/stylus/contracts/mint-up-event-pass`: contrato Event Pass en Rust con OpenZeppelin Stylus.
- `packages/stylus/scripts`: compilación, despliegue, ABI y validaciones end-to-end.
- `packages/nextjs`: interfaz web para adquirir, gestionar y revender pases.
- `nitro-devnode`: red local compatible con Stylus para desarrollo y pruebas.

## Inicio rápido

Requisitos: Node `>=20.18`, Yarn 3, Rust, Docker, Foundry Cast y Solc.

```bash
# Instalar dependencias y submódulos
yarn install
git submodule update --init --recursive

# Terminal 1: iniciar la red local
yarn chain

# Terminal 2: desplegar el contrato
yarn deploy

# Terminal 3: iniciar la aplicación
yarn start
```

Abre `http://localhost:3000` para explorar la aplicación.

## Comandos útiles

```bash
yarn stylus:test       # pruebas del contrato
yarn test:local        # flujo on-chain local completo
yarn demo:validate     # validar el despliegue de demostración
yarn deploy --network sepolia
```

## Estado del contrato

El contrato usa USDC, mantiene los pagos protegidos hasta el inicio del evento y restringe todo movimiento del pase a operaciones autorizadas por Mint Up. La interfaz Solidity completa está en `packages/stylus/contracts/mint-up-event-pass/abi/IMintUpEventPass.sol`.

Consulta `CONTEXT.md` para el lenguaje del producto y `packages/stylus/contracts/mint-up-event-pass/README.md` para el modelo técnico completo.

## Documentación

- [Documentación de Scaffold Stylus](https://arb-stylus.github.io/scaffold-stylus-docs/)
- [Documentación de Arbitrum Stylus](https://docs.arbitrum.io/stylus)
- [Guía de contribución](./CONTRIBUTING.md)
