export type Role = "owner" | "admin" | "member";
export type Channel = "WEB";
export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED";
export type MessageRole = "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type DocumentStatus = "UPLOADED" | "PROCESSING" | "READY" | "FAILED";

export type UserLite = { id: string; name: string; email?: string; image?: string | null };

export type WorkspaceSettings = {
  id: string;
  workspaceId: string;
  publicKey: string;
  businessName: string | null;
  businessDescription: string | null;
  website: string | null;
  supportEmail: string | null;
  aiEnabled: boolean;
  aiName: string;
  aiInstructions: string | null;
  confidenceThreshold: number;
  autoCreateTickets: boolean;
  widgetColor: string;
  widgetGreeting: string;
  widgetPosition: "left" | "right";
  askForEmail: boolean;
};

export type WorkspaceInfo = {
  workspace: { id: string; name: string; slug: string; logo: string | null; createdAt: string };
  settings: WorkspaceSettings;
  role: Role;
  user: UserLite;
  embed: { scriptUrl: string; snippet: string };
  features: Record<"openai" | "pinecone" | "r2" | "trigger" | "hubspot" | "slack" | "linear" | "email" | "billing" | "langfuse", boolean>;
};

export type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  visitorId: string | null;
  crmContactId: string | null;
  metadata: { referrer?: string; [key: string]: unknown } | null;
  createdAt: string;
  lastSeenAt: string;
};

export type TicketLite = { id: string; number: number; status: TicketStatus; title: string; priority: TicketPriority };

export type Conversation = {
  id: string;
  workspaceId: string;
  customerId: string;
  channel: Channel;
  status: ConversationStatus;
  aiActive: boolean;
  assigneeId: string | null;
  subject: string | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  customer: Customer;
  assignee: UserLite | null;
  tickets: TicketLite[];
};

export type Message = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  authorId: string | null;
  author?: UserLite | null;
  metadata: MessageMetadata | null;
  createdAt: string;
};

export type ConversationDetail = Conversation & {
  messages: Message[];
  tickets: Ticket[];
  otherConversations: { id: string; subject: string | null; status: ConversationStatus; channel: Channel; lastMessageAt: string }[];
};

export type Ticket = {
  id: string;
  number: number;
  workspaceId: string;
  conversationId: string | null;
  customerId: string | null;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  proposedResolution: string | null;
  createdByAi: boolean;
  assigneeId: string | null;
  externalLinks: { slack?: { url: string | null; channel: string; sentAt: string }; linear?: { url: string; identifier: string; sentAt: string } } | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: Customer | null;
  assignee: UserLite | null;
  conversation: { id: string; channel: Channel; status: ConversationStatus; subject: string | null } | null;
};

export type TicketActivity = { id: string; type: string; message: string; createdAt: string; actor: UserLite | null; data: unknown };
export type TicketDetail = Ticket & { activities: TicketActivity[]; destinations: { slack: boolean; linear: boolean } };

export type DocumentItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number;
  version: number;
  indexedAt: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy: { id: string; name: string } | null;
};

export type Integration = {
  id: string;
  provider: "HUBSPOT" | "SLACK" | "LINEAR";
  status: string;
  config: Record<string, string | undefined>;
  externalAccountName: string | null;
  createdAt: string;
};

export type MemberRow = {
  id: string;
  role: Role;
  createdAt: string;
  user: UserLite & { email: string };
  stats: { openConversations: number; openTickets: number; resolvedTickets7d: number; replies7d: number };
};

export type Invitation = { id: string; email: string; role: Role; status: string; expiresAt: string; createdAt: string };

export type PlanId = "free" | "starter" | "growth";
export type PlanLimits = { seats: number; aiRepliesPerMonth: number; documents: number };
export type BillingInfo = {
  enabled: boolean;
  currentPlan: PlanId;
  limits: PlanLimits;
  subscription: { plan: PlanId; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; lastPaymentAt: string | null };
  usage: { seats: number; members: number; pendingInvites: number; aiRepliesThisMonth: number; documents: number };
  plans: { id: PlanId; name: string; limits: PlanLimits; highlights: string[]; price: { amount: number; currency: string }; available: boolean }[];
};

/** Free-form metadata the backend attaches to messages (AI sources, guardrails, feedback, delivery status…). */
export type MessageMetadata = {
  kind?: string;
  ticketId?: string;
  sources?: { documentName: string; score: number }[];
  confidence?: number;
  feedback?: { value: number | null };
  guardrails?: { inputAction?: string; outputAction?: string; input?: string[]; output?: string[] };
  traceId?: string;
  deliveryError?: string;
  [key: string]: unknown;
};
