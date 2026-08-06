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
  getContext,
  getLighting,
  getSubject,
  type SubjectGroup,
} from "@/lib/presets";
import { CONTROL_MODES, type ControlMode } from "@/lib/providers/types";
import { Badge, Button, Field, Panel, Slider, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface RenderSettings {
  subjectId: string;
  contextId: string;
  lightingId: string;
  /** Set to CUSTOM_PRESET_ID once the user edits the composed prompt by hand. */
  presetId: string;
  prompt: string;
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

function buildDefaults(): RenderSettings {
  const subject = getSubject(DEFAULT_SUBJECT_ID)!;
  return {
    subjectId: subject.id,
    contextId: DEFAULT_CONTEXT_ID,
    lightingId: DEFAULT_LIGHTING_ID,
    presetId: subject.id,
    prompt: composePrompt(subject.id, DEFAULT_CONTEXT_ID, DEFAULT_LIGHTING_ID),
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
  disabled,
}: {
  settings: RenderSettings;
  onChange: (settings: RenderSettings) => void;
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
    subjectId?: string;
    contextId?: string;
    lightingId?: string;
  }) => {
    const subjectId = next.subjectId ?? settings.subjectId;
    const contextId = next.contextId ?? settings.contextId;
    const lightingId = next.lightingId ?? settings.lightingId;
    const subject = getSubject(subjectId);

    onChange({
      ...settings,
      subjectId,
      contextId,
      lightingId,
      presetId: subjectId,
      prompt: composePrompt(subjectId, contextId, lightingId),
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
  const context = getContext(settings.contextId);
  const lighting = getLighting(settings.lightingId);
  const isCustom = settings.presetId === CUSTOM_PRESET_ID;
  const groupSubjects = SUBJECT_PRESETS.filter((p) => p.group === activeGroup);

  return (
    <div className="space-y-3">
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

        <div className="space-y-1.5">
          {groupSubjects.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => recompose({ subjectId: preset.id })}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                settings.subjectId === preset.id
                  ? "border-action bg-module-soft"
                  : "border-border bg-surface-2 hover:bg-hover",
              )}
            >
              <p className="text-[12px] font-medium">{preset.name}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-ink-500">
                {preset.description}
              </p>
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
        {context?.description ? (
          <p className="flex gap-1.5 rounded-md bg-surface-2 p-2 text-[10px] leading-relaxed text-ink-500">
            <Info className="mt-px h-3 w-3 shrink-0" />
            {context.description}
          </p>
        ) : null}
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
        {lighting?.description ? (
          <p className="flex gap-1.5 rounded-md bg-surface-2 p-2 text-[10px] leading-relaxed text-ink-500">
            <Info className="mt-px h-3 w-3 shrink-0" />
            {lighting.description}
          </p>
        ) : null}
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
        <Field
          label={
            <span className="flex items-center gap-2">
              Prompt đã ghép
              {isCustom ? (
                <Badge tone="action" dot>
                  Tuỳ chỉnh
                </Badge>
              ) : null}
            </span>
          }
          hint="Ghép tự động từ Loại công trình + Bối cảnh + Ánh sáng. Sửa tay sẽ chuyển sang chế độ tuỳ chỉnh."
        >
          <Textarea
            rows={8}
            value={settings.prompt}
            disabled={disabled}
            onChange={(event) =>
              patch({ prompt: event.target.value, presetId: CUSTOM_PRESET_ID })
            }
          />
        </Field>

        <Field
          label="Loại trừ (negative prompt)"
          hint="FLUX.1 dev bỏ qua trường này — chỉ lưu vào lịch sử. Muốn loại bỏ thứ gì thì diễn đạt thành câu khẳng định trong prompt chính."
        >
          <Textarea
            rows={2}
            value={settings.negativePrompt}
            disabled={disabled}
            onChange={(event) => patch({ negativePrompt: event.target.value })}
          />
        </Field>
      </Panel>

      <Panel title="ControlNet — bám hình khối gốc">
        <div className="space-y-1.5">
          {CONTROL_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => patch({ controlMode: mode.id })}
              className={cn(
                "w-full rounded-md border px-3 py-2 text-left transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                settings.controlMode === mode.id
                  ? "border-action bg-module-soft"
                  : "border-border bg-surface-2 hover:bg-hover",
              )}
            >
              <p className="text-[12px] font-medium">{mode.label}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-ink-500">
                {mode.hint}
              </p>
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
          hint={
            settings.controlMode === "none"
              ? "Không áp dụng khi tắt ControlNet."
              : "Cầu và hầm nên để 0.92–0.97 (sai hình học là bị bắt lỗi ngay). Đường và cảnh quan 0.85–0.9 là đủ."
          }
        />

        <Slider
          label="Mức biến đổi ảnh gốc"
          value={settings.strength}
          onChange={(strength) => patch({ strength })}
          min={0}
          max={1}
          step={0.01}
          disabled={disabled}
          hint="Ảnh 3D chưa gán vật liệu hoặc bản vẽ CAD: để 0.92–0.95. Ảnh đã có vật liệu đúng: hạ xuống 0.6–0.8."
        />
      </Panel>

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
        <p className="text-[10px] leading-relaxed text-ink-500">
          {RESOLUTION_TIERS.find((t) => t.id === settings.resolutionId)?.description}
        </p>
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
