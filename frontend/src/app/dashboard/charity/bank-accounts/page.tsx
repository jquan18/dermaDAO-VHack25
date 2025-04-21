"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Check,
  Plus,
  CreditCard,
  Building,
  Landmark,
  MapPin,
  Globe,
  Info,
  Tag,
} from "lucide-react";
import { bankAccountsApi } from "@/lib/api";

export default function BankAccountsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // New account form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCountry, setBankCountry] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [purpose, setPurpose] = useState("implementation");
  
  // Fetch bank accounts
  const fetchBankAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await bankAccountsApi.listBankAccounts();
      setAccounts(response.data.bank_accounts || []);
    } catch (err: any) {
      console.error("Error fetching bank accounts:", err);
      setError(err.response?.data?.error?.message || "Failed to load bank accounts");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchBankAccounts();
  }, []);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate input fields
      if (!/^\d{5,30}$/.test(accountNumber)) {
        setError("Account number must be 5-30 digits only");
        setIsSubmitting(false);
        return;
      }
      
      if (!/^\d{5,20}$/.test(routingNumber)) {
        setError("Routing number must be 5-20 digits only");
        setIsSubmitting(false);
        return;
      }
      
      if (swiftCode && !/^[A-Z0-9]{8,11}$/.test(swiftCode)) {
        setError("SWIFT code must be 8-11 characters, uppercase letters and digits only");
        setIsSubmitting(false);
        return;
      }
      
      // Convert country names to ISO codes
      const countryCode = getCountryCode(bankCountry);
      
      // Convert purpose to match backend expectations
      const convertedPurpose = convertPurpose(purpose);
      
      const bankAccountData = {
        account_name: accountName,
        account_number: accountNumber,
        routing_number: routingNumber,
        bank_name: bankName,
        bank_country: countryCode,
        bank_address: bankAddress,
        swift_code: swiftCode ? swiftCode.toUpperCase() : "",
        purpose: convertedPurpose,
      };
      
      console.log("Sending bank account data:", bankAccountData);
      
      const response = await bankAccountsApi.registerBankAccount(bankAccountData);
      
      // Reset form and close dialog
      resetForm();
      setIsDialogOpen(false);
      
      // Show success message and refresh accounts
      setSuccess("Bank account registered successfully");
      setTimeout(() => setSuccess(null), 5000);
      
      fetchBankAccounts();
    } catch (err: any) {
      console.error("Error registering bank account:", err);
      const errorMessage = err.response?.data?.error?.message || 
                           err.response?.data?.error?.details?.[0]?.msg ||
                           "Failed to register bank account";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset form
  const resetForm = () => {
    setAccountName("");
    setAccountNumber("");
    setRoutingNumber("");
    setBankName("");
    setBankCountry("");
    setBankAddress("");
    setSwiftCode("");
    setPurpose("implementation");
  };
  
  // Get badge variant based on account purpose
  const getPurposeBadge = (purpose: string) => {
    switch (purpose) {
      case "implementation":
        return "default";
      case "administrative":
        return "secondary";
      case "emergency":
        return "destructive";
      default:
        return "outline";
    }
  };
  
  // Get badge label based on account purpose
  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case "implementation":
        return "Implementation";
      case "administrative":
        return "Administrative";
      case "emergency":
        return "Emergency";
      default:
        return purpose.charAt(0).toUpperCase() + purpose.slice(1);
    }
  };
  
  // Convert country names to ISO 3166-1 alpha-2 codes
  const getCountryCode = (countryName: string): string => {
    const countryCodes: Record<string, string> = {
      "United States": "US",
      "United Kingdom": "GB",
      "Canada": "CA",
      "Australia": "AU",
      "Germany": "DE",
      "France": "FR",
      "India": "IN",
      "Japan": "JP",
      "Brazil": "BR",
      "Other": "US", // Default to US if "Other" is selected
    };
    return countryCodes[countryName] || "US";
  };
  
  // Convert frontend purpose values to backend expected values
  const convertPurpose = (frontendPurpose: string): string => {
    const purposeMap: Record<string, string> = {
      "implementation": "donations",
      "administrative": "operational",
      "emergency": "general"
    };
    return purposeMap[frontendPurpose] || "general";
  };
  
  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Accounts</h1>
          <p className="text-gray-600">
            Manage bank accounts for receiving funds from withdrawal proposals
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Register Bank Account</DialogTitle>
                <DialogDescription>
                  Enter your bank account details for receiving funds
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account-name">Account Name</Label>
                    <Input
                      id="account-name"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Organization Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-number">Account Number</Label>
                    <Input
                      id="account-number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="1234567890"
                      pattern="[0-9]{5,30}"
                      title="Account number must be 5-30 digits only"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="routing-number">Routing Number</Label>
                    <Input
                      id="routing-number"
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456789"
                      pattern="[0-9]{5,20}"
                      title="Routing number must be 5-20 digits only"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swift-code">SWIFT/BIC Code (Optional)</Label>
                    <Input
                      id="swift-code"
                      value={swiftCode}
                      onChange={(e) => setSwiftCode(e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase())}
                      placeholder="ABCDUS12"
                      pattern="[A-Z0-9]{8,11}"
                      title="SWIFT code must be 8-11 characters, uppercase letters and digits only"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input
                      id="bank-name"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Chase Bank"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-country">Bank Country</Label>
                    <Select value={bankCountry} onValueChange={setBankCountry} required>
                      <SelectTrigger id="bank-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="Australia">Australia</SelectItem>
                        <SelectItem value="Germany">Germany</SelectItem>
                        <SelectItem value="France">France</SelectItem>
                        <SelectItem value="India">India</SelectItem>
                        <SelectItem value="Japan">Japan</SelectItem>
                        <SelectItem value="Brazil">Brazil</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bank-address">Bank Address</Label>
                  <Textarea
                    id="bank-address"
                    value={bankAddress}
                    onChange={(e) => setBankAddress(e.target.value)}
                    placeholder="123 Main St, New York, NY 10001"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="purpose">Account Purpose</Label>
                  <Select value={purpose} onValueChange={setPurpose} required>
                    <SelectTrigger id="purpose">
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="implementation">Implementation (Project Funds)</SelectItem>
                      <SelectItem value="administrative">Administrative (Operational Expenses)</SelectItem>
                      <SelectItem value="emergency">Emergency (Urgent Transfers)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    This helps classify bank accounts for proper fund allocation
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Registering..." : "Register Account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}
      
      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
              <CardFooter>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      {/* No accounts message */}
      {!isLoading && accounts.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No bank accounts</h3>
          <p className="mt-2 text-sm text-gray-500">
            Register a bank account to receive funds from withdrawal proposals
          </p>
          <Button 
            className="mt-4" 
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Bank Account
          </Button>
        </div>
      )}
      
      {/* Accounts list */}
      {!isLoading && accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <div className={`h-2 ${
                account.is_verified 
                  ? 'bg-green-500' 
                  : 'bg-amber-400'
              }`}></div>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{account.account_name}</CardTitle>
                    <CardDescription>{account.bank_name}</CardDescription>
                  </div>
                  <Badge variant={getPurposeBadge(account.purpose)}>
                    {getPurposeLabel(account.purpose)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="text-sm text-gray-500 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                    Account Number
                  </div>
                  <div className="font-medium">••••{account.account_number.slice(-4)}</div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-sm text-gray-500 flex items-center">
                    <Building className="h-4 w-4 mr-2 text-gray-400" />
                    Bank Information
                  </div>
                  <div className="font-medium">
                    {account.bank_name}
                    {account.swift_code && <span className="ml-2 text-sm text-gray-500">({account.swift_code})</span>}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-sm text-gray-500 flex items-center">
                    <Globe className="h-4 w-4 mr-2 text-gray-400" />
                    Country
                  </div>
                  <div className="font-medium">{account.bank_country}</div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center border-t bg-gray-50 p-4">
                <div className="flex items-center">
                  <div className={`
                    w-2 h-2 rounded-full mr-2 
                    ${account.is_verified ? 'bg-green-500' : 'bg-amber-400'}
                  `}></div>
                  <span className="text-sm text-gray-600">
                    {account.is_verified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/charity/bank-accounts/${account.id}`)}>
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
          
          {/* Add new account card */}
          <Card className="border-dashed flex flex-col items-center justify-center p-6 h-full min-h-[300px]">
            <CreditCard className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium mb-2">Add New Account</h3>
            <p className="text-gray-500 text-center mb-4">
              Register another bank account for different purposes
            </p>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </Card>
        </div>
      )}
      
      {/* Information section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <Info className="h-6 w-6 text-blue-500 mr-4 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-blue-700 mb-2">Why register multiple bank accounts?</h3>
            <p className="text-blue-600 mb-4">
              It's recommended to register separate bank accounts for different purposes:
            </p>
            <ul className="space-y-2 text-blue-600">
              <li className="flex items-start">
                <Check className="h-4 w-4 text-blue-500 mr-2 mt-1" />
                <span><strong>Implementation accounts</strong> receive funds directly related to project execution</span>
              </li>
              <li className="flex items-start">
                <Check className="h-4 w-4 text-blue-500 mr-2 mt-1" />
                <span><strong>Administrative accounts</strong> handle operational costs and overhead expenses</span>
              </li>
              <li className="flex items-start">
                <Check className="h-4 w-4 text-blue-500 mr-2 mt-1" />
                <span><strong>Emergency accounts</strong> enable rapid access to funds for urgent needs</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 