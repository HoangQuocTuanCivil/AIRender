"use client";

import { useState } from "react";
import { ChevronDown, Dices, Info, RotateCcw } from "lucide-react";
import {
  CONTEXT_MODIFIERS,
  CUSTOM_PRESET_ID,
  DEFAULT_CONTEXT_ID,
  DEFAULT_LIGHTING_ID,
  DEFAULT_RESOLUTION_ID,
  DEFAULT_SUBJECT_ID,
  LIGHTING_MODIFIERS,
  RESOLUTION_TIERS,
  SUBJECT_GROUPS,
  SUBJECT_PRESETS,
  composePrompt,
  defaultNegativePrompt,
  getSubject,
  type PromptStyle,
  type SubjectGroup,
} from "@/lib/presets";
import { CONTROL_MODES, type ControlMode } from "@/lib/providers/types";
import { Badge, Button, Field, Panel, Slider, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ProviderInfo {
  id: string;
  label: string;
  blurb: string;
  configured: boolean;
  supportsControlNet: boolean;
  promptStyle: PromptStyle;
  apiKeyEnv: string;
  apiKeyUrl: string;
}

export interface RenderSettings {
  /** Which engine renders the job — decides ControlNet availability and prompt style. */
  providerId: string;
  subjectId: string;
  contextId: string;
  lightingId: string;
  /** Set to CUSTOM_PRESET_ID once the user edits the composed prompt by hand. */
  presetId: string;
  prompt: string;
  /** Project-specific free text, appended to the composed prompt. */
  extraDetails: string;
  negativePrompt: string;
  controlMode: ControlMode;
  controlStrength: number;
  strength: number;
  guidanceScale: number;
  steps: number;
  numImages: number;
  seed: number | null;
  resolutionId: string;
  outputFormat: "jpeg" | "png";
}

export const DEFAULT_PROVIDER_ID = "fal";

function buildDefaults(): RenderSettings {
  const subject = getSubject(DEFAULT_SUBJECT_ID)!;
  return {
    providerId: DEFAULT_PROVIDER_ID,
    subjectId: subject.id,
    contextId: DEFAULT_CONTEXT_ID,
    lightingId: DEFAULT_LIGHTING_ID,
    presetId: subject.id,
    prompt: composePrompt(
      subject.id,
      DEFAULT_CONTEXT_ID,
      DEFAULT_LIGHTING_ID,
      "describe",
    ),
    extraDetails: "",
    negativePrompt: defaultNegativePrompt(),
    controlMode: subject.defaults.controlMode,
    controlStrength: subject.defaults.controlStrength,
    strength: subject.defaults.strength,
    guidanceScale: subject.defaults.guidanceScale,
    steps: subject.defaults.steps,
    numImages: 1,
    seed: null,
    resolutionId: DEFAULT_RESOLUTION_ID,
    outputFormat: "jpeg",
  };
}

export const DEFAULT_SETTINGS: RenderSettings = buildDefaults();

export function ControlPanel({
  settings,
  onChange,
  providers,
  disabled,
}: {
  settings: RenderSettings;
  onChange: (settings: RenderSettings) => void;
  providers: ProviderInfo[];
  disabled?: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<SubjectGroup>(
    getSubject(settings.subjectId)?.group ?? "Đường bộ",
  );

  const patch = (next: Partial<RenderSettings>) =>
    onChange({ ...settings, ...next });

  /**
   * Any axis change recomposes the prompt from scratch — that is the point of
   * the axes. Manual edits to the prompt box are therefore overwritten, which
   * is why the box is marked "Tuỳ chỉnh" once touched.
   */
  const recompose = (next: {
    providerId?: string;
    subjectId?: string;
    contextId?: string;
    lightingId?: string;
    extraDetails?: string;
  }) => {
    const providerId = next.providerId ?? settings.providerId;
    const subjectId = next.subjectId ?? settings.subjectId;
    const contextId = next.contextId ?? settings.contextId;
    const lightingId = next.lightingId ?? settings.lightingId;
    const extraDetails = next.extraDetails ?? settings.extraDetails;
    const subject = getSubject(subjectId);

    // Switching engine also switches prompt grammar: FLUX wants a scene
    // description, Nano Banana wants an edit instruction.
    const style =
      providers.find((p) => p.id === providerId)?.promptStyle ?? "describe";

    onChange({
      ...settings,
      providerId,
      subjectId,
      contextId,
      lightingId,
      extraDetails,
      presetId: subjectId,
      prompt: composePrompt(subjectId, contextId, lightingId, style, extraDetails),
      // Switching subject also adopts that structure type's tuning: a
      // cable-stayed bridge needs a much tighter grip than an urban street.
      ...(next.subjectId && subject
        ? {
            controlMode: subject.defaults.controlMode,
            controlStrength: subject.defaults.controlStrength,
            strength: subject.defaults.strength,
            guidanceScale: subject.defaults.guidanceScale,
            steps: subject.defaults.steps,
          }
        : {}),
    });
  };

  const subject = getSubject(settings.subjectId);
  const isCustom = settings.presetId === CUSTOM_PRESET_ID;
  const groupSubjects = SUBJECT_PRESETS.filter((p) => p.group === activeGroup);
  const engine = providers.find((p) => p.id === settings.providerId);
  const usesControlNet = engine?.supportsControlNet ?? true;

  return (
    <div className="space-y-3">
      {providers.length > 0 ? (
        <Panel title="Công cụ render">
          <div className="space-y-1.5">
            {providers.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={disabled || !item.configured}
                onClick={() => recompose({ providerId: item.id })}
                title={
                  item.configured
                    ? item.blurb
                    : `Cần ${item.apiKeyEnv} — thêm ở mục Cài đặt`
                }
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left transition-colors",
                  "disabled:pointer-events-none disabled:opacity-45",
                  settings.providerId === item.id
                    ? "border-action bg-module-soft"
                    : "border-border bg-surface-2 hover:bg-hover",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-medium">{item.label}</span>
                  {!item.configured ? (
                    <Badge tone="danger">thiếu key</Badge>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-ink-500">
                  {item.blurb}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}
      <Panel title="Loại công trình">
        <div className="flex flex-wrap gap-1">
          {SUBJECT_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              disabled={disabled}
              onClick={() => setActiveGroup(group)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                activeGroup === group
                  ? "bg-action text-white"
                  : "bg-surface-2 text-ink-500 hover:bg-hover hover:text-ink-950",
              )}
            >
              {group}
            </button>
          ))}
        </div>

        {/* Descriptions live in the tooltip, not inline — with 23 subjects plus
            two more axes below, inline blurbs pushed the Render button several
            screens down. */}
        <div className="space-y-1">
          {groupSubjects.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => recompose({ subjectId: preset.id })}
              title={preset.description}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left text-[12px] font-medium transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                settings.subjectId === preset.id
                  ? "border-action bg-module-soft"
                  : "border-border bg-surface-2 hover:bg-hover",
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {subject && subject.group !== activeGroup ? (
          <p className="flex gap-1.5 rounded-md bg-surface-2 p-2 text-[10px] leading-relaxed text-ink-500">
            <Info className="mt-px h-3 w-3 shrink-0" />
            Đang chọn <strong className="text-ink-950">{subject.name}</strong>{" "}
            ở nhóm {subject.group}.
          </p>
        ) : null}
      </Panel>

      <Panel title="Bối cảnh">
        <div className="grid grid-cols-2 gap-1.5">
          {CONTEXT_MODIFIERS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => recompose({ contextId: item.id })}
              title={item.description}
              className={cn(
                "rounded-md border px-2.5 py-2 text-left text-[11px] leading-tight transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                settings.contextId === item.id
                  ? "border-action bg-module-soft text-ink-950"
                  : "border-border bg-surface-2 text-ink-500 hover:bg-hover hover:text-ink-950",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Ánh sáng">
        <div className="grid grid-cols-2 gap-1.5">
          {LIGHTING_MODIFIERS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => recompose({ lightingId: item.id })}
              title={item.description}
              className={cn(
                "rounded-md border px-2.5 py-2 text-left text-[11px] leading-tight transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                settings.lightingId === item.id
                  ? "border-action bg-module-soft text-ink-950"
                  : "border-border bg-surface-2 text-ink-500 hover:bg-hover hover:text-ink-950",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="Prompt"
        action={
          isCustom ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => recompose({})}
              title="Dựng lại prompt từ 3 lựa chọn ở trên"
            >
              <RotateCcw className="h-3 w-3" />
              Dựng lại
            </Button>
          ) : null
        }
      >
        {/* The safe place to type. Held as its own field, so changing an axis
            re-composes the prompt around it instead of discarding it. */}
        <Field
          label="Chi tiết riêng của dự án"
          hint="Tiếng Anh. Ví dụ: exactly 4 lanes in each direction · weathering steel girder · pylon painted deep red · flowering flamboyant trees. Không mất khi đổi Loại công trình / Bối cảnh / Ánh sáng."
        >
          <Textarea
            rows={3}
            value={settings.extraDetails}
            disabled={disabled}
            placeholder="exactly 4 lanes in each direction, weathering steel girder…"
            onChange={(event) =>
              recompose({ extraDetails: event.target.value })
            }
          />
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2">
              Prompt đầy đủ
              {isCustom ? (
                <Badge tone="action" dot>
                  Tuỳ chỉnh
                </Badge>
              ) : null}
            </span>
          }
          hint={
            isCustom
              ? "Đang sửa tay. Đổi bất kỳ lựa chọn nào ở trên sẽ ghi đè đoạn bạn vừa gõ — dùng ô Chi tiết riêng để giữ an toàn."
              : "Ghép tự động từ các lựa chọn ở trên. Bình thường không cần sửa ô này."
          }
        >
          <Textarea
            rows={7}
            value={settings.prompt}
            disabled={disabled}
            onChange={(event) =>
              patch({ prompt: event.target.value, presetId: CUSTOM_PRESET_ID })
            }
          />
        </Field>
      </Panel>

      {/* Edit models have no control map, so there is no adherence dial to
          show — hiding the panel is honest; disabling it would suggest the
          settings still apply. */}
      {usesControlNet ? (
        <Panel title="ControlNet — bám hình khối gốc">
          <div className="space-y-1">
            {CONTROL_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                disabled={disabled}
                onClick={() => patch({ controlMode: mode.id })}
                title={mode.hint}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-[12px] font-medium transition-colors",
                  "disabled:pointer-events-none disabled:opacity-50",
                  settings.controlMode === mode.id
                    ? "border-action bg-module-soft"
                    : "border-border bg-surface-2 hover:bg-hover",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <Slider
            label="Độ bám hình khối"
            value={settings.controlStrength}
            onChange={(controlStrength) => patch({ controlStrength })}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled || settings.controlMode === "none"}
          />

          <Slider
            label="Mức biến đổi ảnh gốc"
            value={settings.strength}
            onChange={(strength) => patch({ strength })}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
          />
        </Panel>
      ) : null}

      <Panel title="Độ phân giải">
        <div className="flex gap-1.5">
          {RESOLUTION_TIERS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              disabled={disabled}
              onClick={() => patch({ resolutionId: tier.id })}
              title={tier.description}
              className={cn(
                "h-9 flex-1 rounded-md border text-[11px] font-medium transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                settings.resolutionId === tier.id
                  ? "border-action bg-module-soft text-ink-950"
                  : "border-border bg-surface-2 text-ink-500 hover:bg-hover",
              )}
            >
              {tier.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title={
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-950"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                advancedOpen && "rotate-180",
              )}
            />
            Nâng cao
          </button>
        }
      >
        {advancedOpen ? (
          <div className="space-y-3.5">
            {/* Diffusion knobs — meaningless to an edit model, which exposes no
                step count or guidance scale. */}
            {usesControlNet ? (
              <>
            <Slider
              label="Số bước (steps)"
              value={settings.steps}
              onChange={(steps) => patch({ steps })}
              min={8}
              max={50}
              step={1}
              format={(v) => String(v)}
              disabled={disabled}
              hint="Nhiều bước = chi tiết hơn nhưng chậm và tốn hơn. 30–36 là vùng hợp lý cho hạ tầng."
            />

            <Slider
              label="Guidance scale"
              value={settings.guidanceScale}
              onChange={(guidanceScale) => patch({ guidanceScale })}
              min={1}
              max={12}
              step={0.1}
              format={(v) => v.toFixed(1)}
              disabled={disabled}
              hint="FLUX hoạt động tốt nhất quanh 3.5. Cao quá sẽ gây cháy sáng, bệt màu."
            />
              </>
            ) : null}

            <Slider
              label="Số ảnh mỗi lần render"
              value={settings.numImages}
              onChange={(numImages) => patch({ numImages })}
              min={1}
              max={4}
              step={1}
              format={(v) => String(v)}
              disabled={disabled}
              hint="Mỗi ảnh tính phí riêng trên provider."
            />

            <Field
              label="Seed"
              hint="Khoá seed để render nhiều góc của cùng một dự án mà vẫn giữ đồng nhất vật liệu và mùa."
            >
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={2147483647}
                  value={settings.seed ?? ""}
                  disabled={disabled}
                  placeholder="Ngẫu nhiên"
                  onChange={(event) =>
                    patch({
                      seed:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                  className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-[13px] text-ink-950 placeholder:text-ink-400 focus:border-action focus:outline-none"
                />
                <Button
                  variant="default"
                  disabled={disabled}
                  onClick={() =>
                    patch({ seed: Math.floor(Math.random() * 2147483647) })
                  }
                  title="Sinh seed ngẫu nhiên"
                >
                  <Dices className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  disabled={disabled || settings.seed === null}
                  onClick={() => patch({ seed: null })}
                  title="Xoá seed"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </Field>

            {/* Kept only because it is stored in history and would become live
                again behind an SDXL-class provider. Out of the main view so it
                stops reading as a control that does something. */}
            <Field
              label="Loại trừ (negative prompt)"
              hint="Không engine nào hiện có dùng trường này — FLUX và Nano Banana đều bỏ qua. Muốn loại bỏ thứ gì, hãy diễn đạt thành câu khẳng định trong Chi tiết riêng."
            >
              <Textarea
                rows={2}
                value={settings.negativePrompt}
                disabled={disabled}
                onChange={(event) => patch({ negativePrompt: event.target.value })}
              />
            </Field>

            <Field label="Định dạng ảnh ra">
              <div className="flex gap-1.5">
                {(["jpeg", "png"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    disabled={disabled}
                    onClick={() => patch({ outputFormat: format })}
                    className={cn(
                      "h-9 flex-1 rounded-md border text-xs font-medium uppercase transition-colors",
                      "disabled:pointer-events-none disabled:opacity-50",
                      settings.outputFormat === format
                        ? "border-action bg-module-soft text-ink-950"
                        : "border-border bg-surface-2 text-ink-500 hover:bg-hover",
                    )}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
