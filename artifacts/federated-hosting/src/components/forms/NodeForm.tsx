import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateNode, useUpdateNode } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getListNodesQueryKey } from "@workspace/api-client-react";

const nodeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  domain: z.string().min(3, "Domain must be a valid hostname."),
  description: z.string().optional(),
  region: z.string().min(2, "Region is required."),
  operatorName: z.string().min(2, "Operator name is required."),
  operatorEmail: z.string().email("Must be a valid email."),
  storageCapacityGb: z.coerce.number().min(1, "Must have at least 1 GB storage."),
  bandwidthCapacityGb: z.coerce.number().min(1, "Must have at least 1 GB bandwidth."),
  publicKey: z.string().optional(),
});

type NodeFormValues = z.infer<typeof nodeSchema>;

interface NodeFormProps {
  onSuccess?: () => void;
  initialData?: NodeFormValues & { id?: number };
}

export function NodeForm({ onSuccess, initialData }: NodeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<NodeFormValues>({
    resolver: zodResolver(nodeSchema),
    defaultValues: initialData || {
      name: "",
      domain: "",
      description: "",
      region: "",
      operatorName: "",
      operatorEmail: "",
      storageCapacityGb: 100,
      bandwidthCapacityGb: 1000,
      publicKey: "",
    },
  });

  const createMutation = useCreateNode({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNodesQueryKey() });
        toast({ title: "Node Registered", description: "Successfully joined the federation." });
        onSuccess?.();
      },
      onError: (error) => {
        toast({ title: "Registration Failed", description: String(error), variant: "destructive" });
      }
    }
  });

  const updateMutation = useUpdateNode({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNodesQueryKey() });
        toast({ title: "Node Updated", description: "Node configuration saved." });
        onSuccess?.();
      },
      onError: (error) => {
        toast({ title: "Update Failed", description: String(error), variant: "destructive" });
      }
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: NodeFormValues) {
    if (initialData?.id) {
      updateMutation.mutate({ id: initialData.id, data });
    } else {
      createMutation.mutate({ data });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Node Name</FormLabel>
                <FormControl><Input placeholder="e.g. Alpha Prime" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="domain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FQDN / Domain</FormLabel>
                <FormControl><Input placeholder="node1.example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Datacenter Region</FormLabel>
                <FormControl><Input placeholder="us-east-1" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="operatorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Operator Name</FormLabel>
                <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="operatorEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Operator Email</FormLabel>
              <FormControl><Input type="email" placeholder="admin@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="storageCapacityGb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Storage Capacity (GB)</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bandwidthCapacityGb"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bandwidth Limit (GB/mo)</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Textarea placeholder="Node hardware specs or purpose..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto min-w-[150px]">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initialData?.id ? "Save Configuration" : "Initialize Node"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
