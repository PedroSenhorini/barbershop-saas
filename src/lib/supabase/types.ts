export type AppointmentStatus =
  | "solicitado"
  | "confirmado"
  | "a_caminho"
  | "em_andamento"
  | "finalizado"
  | "cancelado"
  | "faltou";

export type StaffRole = "owner" | "barber";

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
  customer_name: string;
  customer_phone: string;
  scheduled_at: string;
  ends_at: string;
  status: AppointmentStatus;
  public_token: string;
  customer_confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentWithRelations = Appointment & {
  service: Pick<Service, "id" | "name" | "duration_minutes" | "price"> | null;
  barber: Pick<StaffUser, "id" | "full_name"> | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
