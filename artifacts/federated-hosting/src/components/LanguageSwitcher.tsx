import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLang } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.slice(0, 2) as SupportedLang;
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "text-muted-foreground hover:text-white gap-1.5 font-normal text-xs h-8 px-2",
            className,
          )}
          title="Change language"
        >
          <span className="text-base leading-none">{current.flag}</span>
          <span className="hidden sm:inline">{current.label}</span>
          <Languages className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-card border-white/10 min-w-[160px]"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={cn(
              "cursor-pointer gap-2 text-sm",
              currentLang === lang.code
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-white",
            )}
          >
            <span className="text-base">{lang.flag}</span>
            {lang.label}
            {currentLang === lang.code && (
              <span className="ml-auto text-primary text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
