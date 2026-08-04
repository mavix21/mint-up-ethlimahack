import { Card, CardContent } from "~~/components/ui/card";
import { ScrollArea } from "~~/components/ui/scroll-area";

type AddressCodeTabProps = {
  bytecode: string;
  assembly: string;
};

export const AddressCodeTab = ({ bytecode, assembly }: AddressCodeTabProps) => {
  const formattedAssembly = Array.from(assembly.matchAll(/\w+( 0x[a-fA-F0-9]+)?/g))
    .map(it => it[0])
    .join("\n");

  return (
    <div className="flex flex-col gap-3 p-4">
      Bytecode
      <Card>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <pre className="whitespace-pre-wrap break-words">
              <code>{bytecode}</code>
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
      Opcodes
      <Card>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <pre>
              <code>{formattedAssembly}</code>
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
