import { EventColor, type CalendarEvent, type EventInput } from "@dasd/cal-shared";
import { Button, cn } from "@dasd/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCalendarEvents, useCreateEvent, useDeleteEvent, useUpdateEvent } from "../api/queries";
import { colorHex } from "../lib/colors";
import {
  allDayEnd,
  allDayStart,
  combineDateTime,
  toDateInput,
  toTimeInput,
  todayDateInput,
} from "../lib/datetime";
import { useUiStore } from "../store/ui";

const controlClass =
  "h-9 w-full rounded-md border border-border bg-[var(--color-input)] px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50";

const eventForm = z
  .object({
    title: z.string().min(1, "Title is required"),
    date: z.string().min(1, "Date is required"),
    startTime: z.string(),
    endTime: z.string(),
    allDay: z.boolean(),
    location: z.string().optional(),
    description: z.string().optional(),
    color: EventColor,
  })
  .superRefine((v, ctx) => {
    if (!v.allDay && v.endTime <= v.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End must be after start" });
    }
  });
type EventForm = z.infer<typeof eventForm>;

function toInput(v: EventForm): EventInput {
  const start = v.allDay ? allDayStart(v.date) : combineDateTime(v.date, v.startTime);
  const end = v.allDay ? allDayEnd(v.date) : combineDateTime(v.date, v.endTime);
  return {
    title: v.title.trim(),
    start,
    end,
    allDay: v.allDay,
    location: v.location?.trim() || undefined,
    description: v.description?.trim() || undefined,
    color: v.color,
  };
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-[var(--color-destructive)]">{error}</span>}
    </label>
  );
}

function EventFormBody({ editing, draftDate }: { editing: CalendarEvent | null; draftDate: string | null }) {
  const closeModal = useUiStore((s) => s.closeModal);
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const remove = useDeleteEvent();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({
    resolver: zodResolver(eventForm),
    defaultValues: editing
      ? {
          title: editing.title,
          date: toDateInput(editing.start),
          startTime: toTimeInput(editing.start),
          endTime: toTimeInput(editing.end),
          allDay: editing.allDay,
          location: editing.location ?? "",
          description: editing.description ?? "",
          color: editing.color,
        }
      : {
          title: "",
          date: draftDate ?? todayDateInput(),
          startTime: "09:00",
          endTime: "10:00",
          allDay: false,
          location: "",
          description: "",
          color: "blue",
        },
  });

  const allDay = watch("allDay");
  const color = watch("color");

  const onSubmit = handleSubmit(async (values) => {
    const body = toInput(values);
    if (editing) await update.mutateAsync({ id: editing.id, patch: body });
    else await create.mutateAsync(body);
    closeModal();
  });

  async function onDelete() {
    if (!editing) return;
    await remove.mutateAsync(editing.id);
    closeModal();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field label="Title" error={errors.title?.message}>
        <input className={controlClass} placeholder="e.g. Dentist appointment" {...register("title")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={errors.date?.message}>
          <input type="date" className={controlClass} {...register("date")} />
        </Field>
        <label className="flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-primary)]"
            {...register("allDay")}
          />
          <span className="text-sm text-foreground">All day</span>
        </label>
      </div>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" error={errors.startTime?.message}>
            <input type="time" className={controlClass} {...register("startTime")} />
          </Field>
          <Field label="End" error={errors.endTime?.message}>
            <input type="time" className={controlClass} {...register("endTime")} />
          </Field>
        </div>
      )}

      <Field label="Location">
        <input className={controlClass} placeholder="Optional" {...register("location")} />
      </Field>

      <Field label="Description">
        <textarea
          className={cn(controlClass, "h-20 resize-none py-2")}
          placeholder="Optional"
          {...register("description")}
        />
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-2">
          {EventColor.options.map((c) => {
            const hex = colorHex(c);
            const selected = color === c;
            return (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={selected}
                onClick={() => setValue("color", c, { shouldDirty: true })}
                className={cn(
                  "h-7 w-7 rounded-full ring-offset-2 ring-offset-[var(--color-surface)] transition",
                  selected ? "ring-2 ring-[var(--color-ring)]" : "ring-0 hover:scale-110",
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </Field>

      <div className="mt-1 flex items-center justify-between">
        {editing ? (
          <Button type="button" variant="ghost" onClick={onDelete} disabled={remove.isPending}>
            <Trash2 size={16} /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {editing ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function EventModal() {
  const modalOpen = useUiStore((s) => s.modalOpen);
  const closeModal = useUiStore((s) => s.closeModal);
  const selectedEventId = useUiStore((s) => s.selectedEventId);
  const draftDate = useUiStore((s) => s.draftDate);
  const eventsQ = useCalendarEvents();

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  if (!modalOpen) return null;

  const editing = selectedEventId
    ? (eventsQ.data ?? []).find((e) => e.id === selectedEventId) ?? null
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      onMouseDown={closeModal}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {editing ? "Edit event" : "New event"}
          </h2>
          <Button variant="ghost" size="icon" onClick={closeModal} aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="p-4">
          <EventFormBody
            key={selectedEventId ?? draftDate ?? "new"}
            editing={editing}
            draftDate={draftDate}
          />
        </div>
      </div>
    </div>
  );
}
