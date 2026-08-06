"use client";

import { useState } from "react";
import { ChevronDown, Dices, Info, RotateCcw } from "lucide-react";
import {
  CUSTOM_PRESET_ID,
  PRESET_GROUPS,
  STYLE_PRESETS,
  getPreset,
} from "@/lib/presets";
import { CONTROL_MODES, type ControlMode } from "@/lib/providers/types";
import { Badge, Button, Field, Panel, Slider, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface RenderSettings {
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
  outputFormat: "jpeg" | "png";
}

export const DEFAULT_SETTINGS: RenderSettings = {
  presetId: STYLE_PRESETS[0].id,
  prompt: STYLE_PRESETS[0].prompt,
  negativePrompt: STYLE_PRESETS[0].negativePrompt,
  controlMode: STYLE_PRESETS[0].defaults.controlMode,
  controlStrength: STYLE_PRESETS[0].defaults.controlStrength,
  strength: STYLE_PRESETS[0].defaults.strength,
  guidanceScale: STYLE_PRESETS[0].defaults.guidanceScale,
  steps: STYLE_PRESETS[0].defaults.steps,
  numImages: 1,
  seed: null,
  outputFormat: "jpeg",
};

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

  const patch = (next: Partial<RenderSettings>) =>
    onChange({ ...settings, ...next });

  /** Selecting a preset overwrites prompt + tuning; that is the point of a preset. */
  const applyPreset = (presetId: string) => {
    const preset = getPreset(presetId);
    if (!preset) return;
    onChange({
      ...settings,
      presetId: preset.id,
      prompt: preset.prompt,
      negativePrompt: preset.negativePrompt,
      controlMode: preset.defaults.controlMode,
      controlStrength: preset.defaults.controlStrength,
      strength: preset.defaults.strength,
      guidanceScale: preset.defaults.guidanceScale,
      steps: preset.defaults.steps,
    });
  };

  const activePreset = getPreset(settings.presetId);
  const isCustom = settings.presetId === CUSTOM_PRESET_ID;

  return (
    <div className="space-y-3">
      <Panel title="Phong cách">
        <div className="space-y-3">
          {PRESET_GROUPS.map((group) => {
            const items = STYLE_PRESETS.filter((p) => p.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted/70">
                  {group}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {items.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => applyPreset(preset.id)}
                      title={preset.description}
                      className={cn(
                        "rounded-md border px-2.5 py-2 text-left text-[11px] leading-tight transition-colors",
                        "disabled:pointer-events-none disabled:opacity-50",
                        settings.presetId === preset.id
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border bg-surface-2 text-muted hover:border-border hover:bg-border/50 hover:text-foreground",
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {activePreset ? (
          <p className="flex gap-1.5 rounded-md bg-surface-2 p-2.5 text-[11px] leading-relaxed text-muted">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            {activePreset.description}
          </p>
        ) : null}
      </Panel>

      <Panel
        title="Prompt"
        action={
          activePreset && !isCustom ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => applyPreset(activePreset.id)}
              title="Khôi phục prompt gốc của preset"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          ) : null
        }
      >
        <Field
          label={
            <span className="flex items-center gap-2">
              Mô tả mong muốn
              {isCustom ? <Badge tone="accent">Tuỳ chỉnh</Badge> : null}
            </span>
          }
          hint="Tiếng Anh cho kết quả tốt hơn nhiều. Sửa prompt sẽ chuyển sang chế độ tuỳ chỉnh."
        >
          <Textarea
            rows={7}
            value={settings.prompt}
            disabled={disabled}
            onChange={(event) =>
              patch({ prompt: event.target.value, presetId: CUSTOM_PRESET_ID })
            }
            placeholder="Photorealistic exterior of a modern villa at golden hour…"
          />
        </Field>

        <Field
          label="Loại trừ (negative prompt)"
          hint="Những thứ KHÔNG muốn xuất hiện trong ảnh."
        >
          <Textarea
            rows={3}
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
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface-2 hover:bg-border/50",
              )}
            >
              <p className="text-[12px] font-medium">{mode.label}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
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
              : "Cao (0.85–1.0) = giữ đúng thiết kế. Thấp = AI tự do sáng tạo hơn."
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
          hint="1.0 = vẽ lại hoàn toàn (nên dùng cho sketch/clay). Thấp = giữ lại nhiều màu sắc ảnh gốc."
        />
      </Panel>

      <Panel
        title={
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-foreground"
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
              hint="Nhiều bước = chi tiết hơn nhưng chậm và tốn hơn. 28–34 là vùng hợp lý."
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
              hint="Cùng seed + cùng tham số = ảnh giống nhau. Để trống là ngẫu nhiên."
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
                  className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-[13px] text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none"
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
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border bg-surface-2 text-muted hover:bg-border/50",
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
