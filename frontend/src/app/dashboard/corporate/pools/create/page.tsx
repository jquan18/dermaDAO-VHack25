"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Info } from "lucide-react";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { quadraticFundingApi } from "@/lib/api";
import { BlurContainer } from "@/components/ui/blur-container";

// Form schema with validation
const formSchema = z.object({
  name: z.string().min(3, {
    message: "Pool name must be at least 3 characters.",
  }).max(100, {
    message: "Pool name must be less than 100 characters."
  }),
  theme: z.string().min(3, {
    message: "Theme must be at least 3 characters.",
  }),
  description: z.string().min(20, {
    message: "Description must be at least 20 characters.",
  }).max(1000, {
    message: "Description must be less than 1000 characters."
  }),
  initialFunding: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Initial funding must be a positive number.",
  }),
  startDate: z.date({
    required_error: "A start date is required.",
  }),
  endDate: z.date({
    required_error: "An end date is required.",
  }).refine((date) => date > new Date(), {
    message: "End date must be in the future.",
  }),
  matchingRatio: z.string().default("1"),
  bannerImage: z.string().optional(),
  logoImage: z.string().optional(),
});

export default function CreatePoolPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with react-hook-form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      theme: "",
      description: "",
      initialFunding: "",
      matchingRatio: "1",
      bannerImage: "",
      logoImage: "",
    },
  });

  // Handle form submission
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      
      // Convert values for API
      const poolData = {
        name: values.name,
        description: values.description,
        theme: values.theme,
        round_duration: Math.floor((values.endDate.getTime() - values.startDate.getTime()) / 1000),
        logo_image: values.logoImage || undefined,
        banner_image: values.bannerImage || undefined,
        matching_ratio: parseInt(values.matchingRatio) || 1
      };
      
      // Call the API to create the pool
      console.log("Creating pool with data:", poolData);
      const result = await quadraticFundingApi.createPool(poolData);
      
      if (result.success) {
        toast({
          title: "Pool created successfully",
          description: `${values.name} has been created.`,
        });
        
        // Redirect to pools list
        router.push("/dashboard/corporate/pools");
      } else {
        throw new Error(result.error?.message || "Failed to create pool");
      }
    } catch (error) {
      console.error("Failed to create pool:", error);
      toast({
        title: "Failed to create pool",
        description: "There was an error creating your funding pool. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Sample theme options
  const themeOptions = [
    "Environmental Sustainability",
    "Healthcare Access",
    "Education",
    "Social Justice",
    "Disaster Relief",
    "Scientific Research",
    "Arts & Culture",
    "Poverty Alleviation",
    "Other"
  ];

  return (
    <div className="py-6 space-y-6">
      <BlurContainer intensity="light" className="mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Funding Pool</h1>
          <p className="text-muted-foreground mt-1">
            Set up a new themed quadratic funding pool for your corporate sponsorship
          </p>
        </div>
      </BlurContainer>

      <BlurContainer intensity="medium">
        <div className="bg-blue-50/90 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800">How Quadratic Funding Works</h3>
            <p className="text-sm text-blue-700">
              Your corporate contribution to the funding pool will be distributed based on the square root of individual donations. 
              This amplifies the impact of small donors and ensures democratic allocation of your sponsorship funds.
            </p>
          </div>
        </div>
      </BlurContainer>

      <BlurContainer>
        <Card className="border-0 bg-transparent">
          <CardHeader>
            <CardTitle>Pool Details</CardTitle>
            <CardDescription>
              Define the parameters for your new funding pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>Pool Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Clean Water Initiative" {...field} />
                        </FormControl>
                        <FormDescription>
                          A clear, concise name for your funding pool
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>Theme</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {themeOptions.map((theme) => (
                              <SelectItem key={theme} value={theme}>
                                {theme}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The focus area of this funding pool
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the purpose and goals of this funding pool..."
                          className="min-h-32"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        A detailed description of what this pool aims to accomplish
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="initialFunding"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>Initial Funding (ETH)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0.01" placeholder="e.g., 10.00" {...field} />
                        </FormControl>
                        <FormDescription>
                          Amount your company will contribute to the pool
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="matchingRatio"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>Matching Ratio</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select matching ratio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1:1 (Standard)</SelectItem>
                            <SelectItem value="2">2:1 (Double)</SelectItem>
                            <SelectItem value="3">3:1 (Triple)</SelectItem>
                            <SelectItem value="4">4:1 (Quadruple)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          For every $1 donated, your company will match $X
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date()
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          When will this funding pool become active
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date <= new Date() || (form.getValues().startDate && date <= form.getValues().startDate)
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          When will this funding pool close for contributions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="logoImage"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>Logo Image URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormDescription>
                          URL to an image that represents this pool
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bannerImage"
                    render={({ field }) => (
                      <FormItem className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
                        <FormLabel>Banner Image URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormDescription>
                          URL to a banner image for the pool
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Pool"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </BlurContainer>
    </div>
  );
}