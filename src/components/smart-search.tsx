
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { smartSearchAction } from "@/app/actions";
import { Form, FormControl, FormField, FormItem } from "./ui/form";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  query: z.string().min(3, "Search query must be at least 3 characters long."),
});

type SearchFormValues = z.infer<typeof searchSchema>;

export function SmartSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: "",
    },
  });

  const onSubmit = async (data: SearchFormValues) => {
    setIsLoading(true);
    setSearchResult(null);
    const response = await smartSearchAction({ query: data.query });
    setIsLoading(false);

    if (response.success) {
      setSearchResult(response.results);
    } else {
      toast({
        variant: "destructive",
        title: "Search Error",
        description: response.error,
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      form.reset();
      setSearchResult(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-muted-foreground gap-2">
          <Search className="h-4 w-4" />
          <span>Smart Search...</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Smart Search</DialogTitle>
          <DialogDescription>
            Ask anything about your data in natural language.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="relative w-full">
            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="e.g., 'How many clients did we add last month?'"
                        className="pl-10"
                        disabled={isLoading}
                      />
                      {isLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
        
        {searchResult && (
           <div className="prose prose-invert max-w-none text-sm font-code rounded-md bg-muted/50 p-4">
             <p>{searchResult}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
