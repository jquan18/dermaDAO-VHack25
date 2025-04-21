"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Eye, Calendar, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { blockchain } from "@/lib/blockchain";
import { ConnectWallet } from "@/components/blockchain/connect-wallet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type Charity = {
  id: number;
  name: string;
  description: string;
  admin: {
    name: string;
    email: string;
  };
  website?: string;
  country?: string;
  registrationNumber?: string;
  documentationIpfsHash?: string;
  isVerified: boolean;
  verificationScore: number;
  verificationNotes?: string;
  createdAt: string;
};

export default function CharitiesVerification() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [charities, setCharities] = useState<Charity[]>([]);
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationInput, setVerificationInput] = useState({
    verified: false,
    score: 0,
    notes: "",
  });
  const [activeTab, setActiveTab] = useState("pending");
  const [walletConnected, setWalletConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not admin
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }

    // Fetch charities - this would be replaced with actual API call
    const fetchCharities = async () => {
      // Mock data for demonstration
      const mockCharities: Charity[] = [
        {
          id: 1,
          name: "Global Health Initiative",
          description: "Providing healthcare access in underserved communities",
          admin: {
            name: "John Doe",
            email: "john@globalhealth.org",
          },
          website: "https://globalhealth.org",
          country: "United States",
          registrationNumber: "12345-G",
          documentationIpfsHash: "ipfs://Qm...",
          isVerified: false,
          verificationScore: 0,
          createdAt: "2023-06-15T12:00:00Z",
        },
        {
          id: 2,
          name: "Clean Water Project",
          description: "Bringing clean water to rural communities",
          admin: {
            name: "Jane Smith",
            email: "jane@cleanwater.org",
          },
          website: "https://cleanwater.org",
          country: "Canada",
          registrationNumber: "CW-789-45",
          documentationIpfsHash: "ipfs://Qm...",
          isVerified: true,
          verificationScore: 85,
          verificationNotes: "Documentation verified successfully. Strong track record.",
          createdAt: "2023-05-20T14:30:00Z",
        },
        {
          id: 3,
          name: "Education for All",
          description: "Promoting education access in developing nations",
          admin: {
            name: "Robert Johnson",
            email: "robert@eduforall.org",
          },
          website: "https://eduforall.org",
          country: "UK",
          registrationNumber: "EFA-2023-112",
          documentationIpfsHash: "ipfs://Qm...",
          isVerified: false,
          verificationScore: 0,
          createdAt: "2023-07-03T09:15:00Z",
        },
      ];
      
      setCharities(mockCharities);
    };

    fetchCharities();
  }, [user, router]);

  const handleVerifyCharity = async () => {
    if (!selectedCharity) return;
    if (!walletConnected) {
      setError("Please connect your wallet first to perform blockchain operations.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Call blockchain service to verify charity
      await blockchain.verifyCharity(
        selectedCharity.id,
        verificationInput.verified,
        verificationInput.score
      );
      
      // Update local state
      setCharities(charities.map(charity => 
        charity.id === selectedCharity.id 
          ? { 
              ...charity, 
              isVerified: verificationInput.verified, 
              verificationScore: verificationInput.score,
              verificationNotes: verificationInput.notes 
            } 
          : charity
      ));
      
      // Reset form
      setSelectedCharity(null);
      setVerificationInput({
        verified: false,
        score: 0,
        notes: "",
      });
      
      // Show success message (would be a toast in a real app)
      alert("Charity verification status updated successfully on blockchain");
    } catch (error: any) {
      console.error("Error verifying charity:", error);
      setError(error.message || "Failed to update charity verification status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openVerifyDialog = (charity: Charity) => {
    setSelectedCharity(charity);
    setVerificationInput({
      verified: charity.isVerified,
      score: charity.verificationScore || 0,
      notes: charity.verificationNotes || "",
    });
  };

  const pendingCharities = charities.filter(charity => !charity.isVerified);
  const verifiedCharities = charities.filter(charity => charity.isVerified);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Charity Verification</h1>
          <p className="text-muted-foreground">
            Review and verify charity organizations requesting approval.
          </p>
        </div>

        <ConnectWallet onConnect={() => setWalletConnected(true)} />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending">
              Pending Verification ({pendingCharities.length})
            </TabsTrigger>
            <TabsTrigger value="verified">
              Verified Charities ({verifiedCharities.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Verification</CardTitle>
                <CardDescription>
                  Charities awaiting admin verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingCharities.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No pending charity verifications
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Registration</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCharities.map((charity) => (
                        <TableRow key={charity.id}>
                          <TableCell className="font-medium">{charity.name}</TableCell>
                          <TableCell>{charity.admin.email}</TableCell>
                          <TableCell>{charity.registrationNumber || "N/A"}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                              {format(new Date(charity.createdAt), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => openVerifyDialog(charity)}
                                  >
                                    Verify
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Verify Charity: {selectedCharity?.name}</DialogTitle>
                                    <DialogDescription>
                                      Review documentation and approve or reject this charity.
                                    </DialogDescription>
                                  </DialogHeader>
                                  
                                  <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label htmlFor="verified">Verification Status</Label>
                                        <Switch 
                                          id="verified" 
                                          checked={verificationInput.verified}
                                          onCheckedChange={(checked) => 
                                            setVerificationInput({
                                              ...verificationInput,
                                              verified: checked
                                            })
                                          }
                                        />
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {verificationInput.verified ? "Charity will be verified" : "Charity will remain unverified"}
                                      </p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label htmlFor="score">Verification Score ({verificationInput.score})</Label>
                                      <Slider
                                        id="score"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[verificationInput.score]}
                                        onValueChange={(value) => 
                                          setVerificationInput({
                                            ...verificationInput,
                                            score: value[0]
                                          })
                                        }
                                      />
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Low Trust</span>
                                        <span>High Trust</span>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <Label htmlFor="notes">Verification Notes</Label>
                                      <Textarea
                                        id="notes"
                                        placeholder="Add notes about verification process"
                                        value={verificationInput.notes}
                                        onChange={(e) => 
                                          setVerificationInput({
                                            ...verificationInput,
                                            notes: e.target.value
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                  
                                  <DialogFooter>
                                    <Button 
                                      variant="outline" 
                                      onClick={() => setSelectedCharity(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      onClick={handleVerifyCharity}
                                      disabled={isSubmitting || !walletConnected}
                                    >
                                      {isSubmitting ? "Processing..." : "Submit Verification"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="verified">
            <Card>
              <CardHeader>
                <CardTitle>Verified Charities</CardTitle>
                <CardDescription>
                  Charities that have been verified by admin
                </CardDescription>
              </CardHeader>
              <CardContent>
                {verifiedCharities.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No verified charities yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifiedCharities.map((charity) => (
                        <TableRow key={charity.id}>
                          <TableCell className="font-medium">{charity.name}</TableCell>
                          <TableCell>
                            <Badge variant={charity.verificationScore >= 80 ? "success" : "default"}>
                              {charity.verificationScore}/100
                            </Badge>
                          </TableCell>
                          <TableCell>{charity.admin.email}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Check className="h-3 w-3 mr-1" /> Verified
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => openVerifyDialog(charity)}
                              >
                                Update
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

const CharityVerificationDialog = ({ charity, onVerify }: { charity: Charity, onVerify: (id: number, verified: boolean, score: number, notes: string) => void }) => {
  const [notes, setNotes] = useState(charity.verificationNotes || '');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = () => {
    setLoading(true);
    // Now we're only updating notes since verification is automatic
    onVerify(charity.id, true, 100, notes);
    setLoading(false);
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          {charity.isVerified ? "View Details" : "Add Notes"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Charity Information</DialogTitle>
          <DialogDescription>
            {charity.isVerified 
              ? "This charity is verified. You can add or update notes." 
              : "All charities are now automatically verified. You can add notes if needed."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Charity Details</Label>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p><strong>Name:</strong> {charity.name}</p>
              <p><strong>Admin:</strong> {charity.admin.name} ({charity.admin.email})</p>
              {charity.website && <p><strong>Website:</strong> {charity.website}</p>}
              {charity.registrationNumber && <p><strong>Registration:</strong> {charity.registrationNumber}</p>}
              {charity.country && <p><strong>Country:</strong> {charity.country}</p>}
              <p><strong>Created:</strong> {new Date(charity.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="documentationLink">Documentation Link</Label>
            {charity.documentationIpfsHash ? (
              <div className="flex items-center space-x-2">
                <Input 
                  id="documentationLink" 
                  value={`ipfs://${charity.documentationIpfsHash}`} 
                  readOnly 
                />
                <Button variant="outline" size="sm" onClick={() => window.open(`https://ipfs.io/ipfs/${charity.documentationIpfsHash}`, '_blank')}>
                  View
                </Button>
              </div>
            ) : (
              <Input id="documentationLink" value="No documentation provided" readOnly />
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="verificationNotes">Admin Notes</Label>
            </div>
            <Textarea 
              id="verificationNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or comments about this charity here..."
              rows={4}
            />
          </div>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Note: All charities are now automatically verified upon registration.
            </AlertDescription>
          </Alert>
        </div>
        
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>Loading...</>
            ) : (
              <>Save Notes</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 