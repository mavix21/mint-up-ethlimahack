import { DebugContracts } from "./_components/DebugContracts";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Depurar contratos",
  description:
    "Depura fácilmente tus contratos de 🏗 Scaffold-Stylus desplegados",
});

const Debug: NextPage = () => {
  return <DebugContracts />;
};

export default Debug;
