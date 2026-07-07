import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queries";
import { CharacterLibrary } from "./characters/CharacterLibrary";
import { Shell } from "./components/Shell";
import { Create } from "./create/Create";
import { PresetGallery } from "./presets/PresetGallery";
import { useUIStore } from "./store/ui";

function RoutedTab() {
  const tab = useUIStore((s) => s.tab);
  if (tab === "presets") return <PresetGallery />;
  if (tab === "characters") return <CharacterLibrary />;
  return <Create />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <RoutedTab />
      </Shell>
    </QueryClientProvider>
  );
}
