import { Composer } from "./Composer";
import { GenerationFeed } from "./GenerationFeed";

export function Create() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <Composer />
      <GenerationFeed />
    </div>
  );
}
