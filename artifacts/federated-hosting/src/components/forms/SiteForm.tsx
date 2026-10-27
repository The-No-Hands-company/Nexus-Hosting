import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCreateSite, useUpdateSite } from "@workspace/api-client-react";
import { useAuth } from "@workspace/auth-web";
import { useNodes } from "@/lib/apiHooks";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Loader2 } from "lucide-react";
import { getListSitesQueryKey } from "@workspace/api-client-react";
import { CreateSiteBodySiteType } from "@workspace/api-client-react";
import type { Site } from "@workspace/api-client-react";

const SUFFIX = ".tnhc.dev";

const siteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  domainSlug: z
    .string()
    .min(2, "Address must be at least 2 characters.")
    .max(63, "Address too long.")
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Use only lowercase letters, numbers, and hyphens."),
  description: z.string().optional(),
  siteType: z.nativeEnum(CreateSiteBodySiteType),
  primaryNodeId: z.coerce.number().optional(),
});

type SiteFormValues = z.infer<typeof siteSchema>;

interface SiteFormProps {
  onSuccess?: (site: Site) => void;
  initialData?: Partial<SiteFormValues> & { id?: number; domain?: string };
}

export function SiteForm({ onSuccess, initialData }: SiteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: nodes } = useNodes();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const defaultSlug = initialData?.domain?.replace(SUFFIX, "") ?? "";

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      domainSlug: defaultSlug,
      description: initialData?.description ?? "",
      siteType: initialData?.siteType ?? "static",
      primaryNodeId: initialData?.primaryNodeId,
    },
  });

  const ownerName =
    user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unknown" : "";
  const ownerEmail = user?.email ?? "";

  const createMutation = useCreateSite({
    mutation: {
      onSuccess: (site) => {
        queryClient.invalidateQueries({ queryKey: getListSitesQueryKey() });
        toast({ title: "Site created", description: `${site.domain} is live on the network.` });
        onSuccess?.(site);
      },
      onError: (error) => {
        toast({ title: "Registration failed", description: String(error), variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateSite({
    mutation: {
      onSuccess: (site) => {
        queryClient.invalidateQueries({ queryKey: getListSitesQueryKey() });
        toast({ title: "Site updated", description: "Configuration saved." });
        onSuccess?.(site);
      },
      onError: (error) => {
        toast({ title: "Update failed", description: String(error), variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: SiteFormValues) {
    const domain = `${data.domainSlug}${SUFFIX}`;
    if (initialData?.id) {
      updateMutation.mutate({
        id: initialData.id,
        data: { name: data.name, domain, description: data.description, siteType: data.siteType, ownerName, ownerEmail },
      });
    } else {
      createMutation.mutate({
        data: { name: data.name, domain, description: data.description, siteType: data.siteType, ownerName, ownerEmail },
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site name</FormLabel>
              <FormControl><Input placeholder="My Portfolio" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domainSlug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Web address</FormLabel>
              <FormControl>
                <div className="flex rounded-md overflow-hidden border border-input focus-within:ring-1 focus-within:ring-ring">
                  <Input
                    {...field}
                    placeholder="my-portfolio"
                    className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                    onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, ""))}
                  />
                  <span className="inline-flex items-center px-3 bg-muted text-muted-foreground text-sm select-none shrink-0 border-l border-input">
                    {SUFFIX}
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
              Advanced options
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl><Input placeholder="A short description of your site" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="siteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="static">Static (HTML/CSS/JS)</SelectItem>
                        <SelectItem value="blog">Blog</SelectItem>
                        <SelectItem value="portfolio">Portfolio</SelectItem>
                        <SelectItem value="nlpl">NLPL Application</SelectItem>
                        <SelectItem value="dynamic">Node.js Application</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryNodeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target node</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "auto" ? undefined : parseInt(val))}
                      defaultValue={field.value ? String(field.value) : "auto"}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Auto-assign" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="auto">Auto-assign (recommended)</SelectItem>
                        {nodes?.map((node) => (
                          <SelectItem key={node.id} value={String(node.id)}>
                            {node.name} ({node.region})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto min-w-[150px]">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initialData?.id ? "Save changes" : "Create site"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
