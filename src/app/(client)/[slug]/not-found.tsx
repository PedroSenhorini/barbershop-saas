import { Scissors } from "lucide-react";

export default function BarbershopNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Scissors className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Barbearia não encontrada</h1>
      <p className="text-sm text-muted-foreground">
        Confira se o link está certo ou peça um novo para a barbearia.
      </p>
    </div>
  );
}
