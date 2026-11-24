export type AppointmentStatus =
  | "solicitado"
  | "confirmado"
  | "a_caminho"
  | "em_andamento"
  | "finalizado"
  | "cancelado"
  | "faltou";

export type StaffRole = "owner" | "barber";

/** fiado = pago depois (debt_payments); plano = coberto pelo Clube. */
export type PaymentMethod = "dinheiro" | "pix" | "cartao" | "fiado" | "plano";
/** Formas em que o dinheiro entra de verdade (caixa, Pix, maquininha). */
export type CashMethod = "dinheiro" | "pix" | "cartao";

export type ExpenseCategory =
  | "produtos"
  | "equipamentos"
  | "aluguel"
  | "luz_agua"
  | "internet"
  | "salarios"
  | "impostos"
  | "outros";

export type Product = {
  id: string;
  barbershop_id: string;
  name: string;
  quantity: number;
  min_quantity: number;
  /** Preço de venda no balcão; null = só uso interno. */
  sale_price: number | null;
  created_at: string;
};

export type Expense = {
  id: string;
  barbershop_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  spent_on: string; // "YYYY-MM-DD"
  product_id: string | null;
  quantity: number | null;
  created_by: string | null;
  created_at: string;
};

export type CashCount = {
  barbershop_id: string;
  day: string; // "YYYY-MM-DD"
  counted: number;
  notes: string | null;
  counted_by: string | null;
  updated_at: string;
};

/** Expediente de um dia. `null` em WeeklyHours significa fechado. */
export type DayHours = {
  open: string; // "HH:mm"
  close: string;
  breakStart: string | null;
  breakEnd: string | null;
};

/** 7 posições indexadas por getDay(): 0 = domingo ... 6 = sábado. */
export type WeeklyHours = (DayHours | null)[];

// Nota: use `type` (não `interface`) para todo shape usado dentro de
// `Database`. Interfaces nomeadas não satisfazem a checagem estrutural que o
// supabase-js faz para inferir `Schema` a partir de `Database[SchemaName]`,
// e o client acaba tipando as respostas como `never` silenciosamente.
export type Barbershop = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  timezone: string;
  weekly_hours: WeeklyHours;
  active: boolean;
  cashback_percent: number;
  google_review_url: string | null;
  meta_pixel_id: string | null;
  about: string | null;
  instagram: string | null;
  plan: "teste" | "ativo" | "individual" | "duo" | "time" | "premium";
  trial_ends_at: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
};

export type StaffUser = {
  id: string;
  barbershop_id: string;
  full_name: string;
  role: StaffRole;
  avatar_url: string | null;
  active: boolean;
  takes_appointments: boolean;
  commission_percent: number;
  product_commission_percent: number;
  monthly_goal: number | null;
  created_at: string;
};

export type Service = {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
};

export type Appointment = {
  id: string;
  barbershop_id: string;
  service_id: string;
  barber_id: string | null;
  /** Cadastro do cliente, ligado pelo telefone (trigger no schema.sql). */
  customer_id: string | null;
  /** Série de horário fixo. */
  series_id: string | null;
  /** Origem do agendamento (?origem= no link). */
  source: string | null;
  customer_name: string;
  customer_phone: string;
  scheduled_at: string;
  ends_at: string;
  status: AppointmentStatus;
  public_token: string;
  customer_confirmed_at: string | null;
  payment_method: PaymentMethod | null;
  amount_paid: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  barbershop_id: string;
  name: string;
  phone: string; // só dígitos
  notes: string | null;
  tags: string[];
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Linha da view customer_stats (números de cada cliente, calculados no banco). */
export type CustomerStats = {
  customer_id: string;
  barbershop_id: string;
  visits: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  next_appointment_at: string | null;
  no_shows: number;
  total_spent: number;
};

export type TimeBlock = {
  id: string;
  barbershop_id: string;
  barber_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export type WaitlistPeriod = "qualquer" | "manha" | "tarde" | "noite";
export type WaitlistStatus = "aguardando" | "avisado" | "agendado" | "desistiu";

export type WaitlistEntry = {
  id: string;
  barbershop_id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string | null;
  barber_id: string | null;
  preferred_date: string | null;
  preferred_period: WaitlistPeriod;
  notes: string | null;
  status: WaitlistStatus;
  notified_at: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  barbershop_id: string;
  customer_id: string | null;
  appointment_id: string | null;
  seller_id: string | null;
  payment_method: Exclude<PaymentMethod, "plano">;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  barbershop_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

export type DebtPayment = {
  id: string;
  barbershop_id: string;
  appointment_id: string | null;
  sale_id: string | null;
  amount: number;
  payment_method: CashMethod;
  paid_on: string;
  received_by: string | null;
  created_at: string;
};

export type CashMovementKind = "abertura" | "sangria" | "suprimento";

export type CashMovement = {
  id: string;
  barbershop_id: string;
  day: string;
  kind: CashMovementKind;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type CashbackEntry = {
  id: string;
  barbershop_id: string;
  customer_id: string;
  appointment_id: string | null;
  amount: number;
  reason: "credito" | "uso" | "ajuste";
  created_by: string | null;
  created_at: string;
};

export type CustomerFeedback = {
  id: string;
  barbershop_id: string;
  appointment_id: string;
  customer_id: string | null;
  barber_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ClubPlan = {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  price: number;
  uses_per_month: number | null;
  active: boolean;
  created_at: string;
};

export type ClubSubscription = {
  id: string;
  barbershop_id: string;
  customer_id: string;
  plan_id: string;
  price: number;
  status: "ativa" | "cancelada";
  started_on: string;
  next_due_on: string;
  canceled_on: string | null;
  sold_by: string | null;
  created_at: string;
};

export type ClubPayment = {
  id: string;
  barbershop_id: string;
  subscription_id: string;
  amount: number;
  payment_method: CashMethod;
  paid_on: string;
  period_start: string;
  received_by: string | null;
  created_at: string;
};

export type Lead = {
  id: string;
  barbershop_id: string;
  name: string;
  phone: string;
  referred_by_phone: string | null;
  source: string | null;
  status: "novo" | "contatado" | "virou_cliente";
  created_at: string;
};

export type AppointmentWithRelations = Appointment & {
  service: Pick<Service, "id" | "name" | "duration_minutes" | "price"> | null;
  barber: Pick<StaffUser, "id" | "full_name"> | null;
};

/** Tabela sem relacionamentos declarados (embeds usam o nome da FK). */
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      barbershops: {
        Row: Barbershop;
        Insert: Partial<Barbershop> & Pick<Barbershop, "name" | "slug">;
        Update: Partial<Barbershop>;
        Relationships: [];
      };
      users: {
        Row: StaffUser;
        Insert: Partial<StaffUser> &
          Pick<StaffUser, "id" | "barbershop_id" | "full_name">;
        Update: Partial<StaffUser>;
        Relationships: [
          {
            foreignKeyName: "users_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: Service;
        Insert: Partial<Service> & Pick<Service, "barbershop_id" | "name">;
        Update: Partial<Service>;
        Relationships: [
          {
            foreignKeyName: "services_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: Appointment;
        Insert: Partial<Appointment> &
          Pick<
            Appointment,
            | "barbershop_id"
            | "service_id"
            | "customer_name"
            | "customer_phone"
            | "scheduled_at"
            | "ends_at"
          >;
        Update: Partial<Appointment>;
        Relationships: [
          {
            foreignKeyName: "appointments_barbershop_id_fkey";
            columns: ["barbershop_id"];
            isOneToOne: false;
            referencedRelation: "barbershops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_barber_id_fkey";
            columns: ["barber_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: Customer;
        // O banco recusa insert pelo app (criação só pelo trigger); o tipo
        // existe porque o supabase-js exige um Insert com formato de objeto.
        Insert: Partial<Customer> & Pick<Customer, "barbershop_id" | "name" | "phone">;
        Update: Partial<Pick<Customer, "name" | "notes" | "tags" | "last_contacted_at">>;
        Relationships: [];
      };
      time_blocks: Table<TimeBlock, "barbershop_id" | "starts_at" | "ends_at">;
      waitlist_entries: Table<WaitlistEntry, "barbershop_id" | "customer_name" | "customer_phone">;
      sales: Table<Sale, "barbershop_id" | "payment_method" | "subtotal" | "total">;
      sale_items: Table<SaleItem, "sale_id" | "barbershop_id" | "description" | "quantity" | "unit_price">;
      debt_payments: Table<DebtPayment, "barbershop_id" | "amount" | "payment_method">;
      cash_movements: Table<CashMovement, "barbershop_id" | "day" | "kind" | "amount">;
      cashback_entries: Table<CashbackEntry, "barbershop_id" | "customer_id" | "amount" | "reason">;
      customer_feedback: Table<CustomerFeedback, "barbershop_id" | "appointment_id" | "rating">;
      club_plans: Table<ClubPlan, "barbershop_id" | "name" | "price">;
      club_subscriptions: Table<ClubSubscription, "barbershop_id" | "customer_id" | "plan_id" | "price">;
      club_payments: Table<ClubPayment, "barbershop_id" | "subscription_id" | "amount" | "payment_method" | "period_start">;
      leads: Table<Lead, "barbershop_id" | "name" | "phone">;
      products: {
        Row: Product;
        Insert: Partial<Product> & Pick<Product, "barbershop_id" | "name">;
        Update: Partial<Product>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: Partial<Expense> &
          Pick<Expense, "barbershop_id" | "category" | "description" | "amount">;
        Update: Partial<Expense>;
        Relationships: [];
      };
      cash_counts: {
        Row: CashCount;
        Insert: Partial<CashCount> & Pick<CashCount, "barbershop_id" | "day" | "counted">;
        Update: Partial<CashCount>;
        Relationships: [];
      };
    };
    Views: {
      customer_stats: {
        Row: CustomerStats;
        Relationships: [];
      };
    };
    Functions: {
      register_purchase: {
        Args: { p_product_id: string; p_quantity: number; p_amount: number; p_spent_on: string };
        Returns: undefined;
      };
      adjust_stock: {
        Args: { p_product_id: string; p_delta: number };
        Returns: number;
      };
      register_sale: {
        Args: {
          p_items: { product_id?: string | null; description?: string; quantity: number; unit_price?: number }[];
          p_payment_method: string;
          p_discount?: number;
          p_customer_id?: string | null;
          p_appointment_id?: string | null;
          p_seller_id?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      register_club_payment: {
        Args: { p_subscription_id: string; p_amount: number; p_method: string; p_paid_on: string };
        Returns: string;
      };
    };
  };
};
