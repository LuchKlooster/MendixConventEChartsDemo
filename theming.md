# Theming — ConventECharts

This guide explains how to make all ConventECharts chart widgets use the same colors as your Mendix Atlas UI application theme.

---

## How ECharts themes work

ECharts has a built-in theme system. You call `echarts.registerTheme(name, themeObject)` once, then pass the same name to `echarts.init(dom, name)`. ECharts applies the palette, text styles, axis styles, and tooltip styles from the theme object to every chart initialized with that name.

A theme object is plain JSON — no JavaScript required. The [ECharts Theme Builder](https://echarts.apache.org/en/theme-builder.html) can produce one interactively, or you can write one by hand.

---

## Overview

The ConventECharts theme system consists of two parts:

1. **ECharts Theme Loader widget** — a non-visual widget that holds the theme name and the theme JSON. It registers the theme at runtime and notifies all chart widgets on the page to reinitialize.
2. **Theme name property on each chart widget** — when set to the same name as the loader, the chart picks up the theme.

Because each Mendix widget bundle has its own isolated copy of the ECharts library, the loader cannot call `registerTheme` directly on the chart's instance. Instead it stores the theme in a shared browser global (`window.__echartsThemeRegistry`) and dispatches a `CustomEvent`. Each chart widget reads the registry and calls `registerTheme` on its own ECharts instance before reinitializing.

---

## Step-by-step setup

### 1. Add the Theme Loader to a shared layout

Place the **ECharts Theme Loader** widget on the layout that is used by all pages where charts appear. This ensures the theme is available before any chart loads.

In Studio Pro, open your layout page and drag the widget to any position — it renders nothing.

Configure its properties:

| Property | Value |
| --- | --- |
| Theme name | A short identifier, e.g. `atlas` |
| Theme JSON | The ECharts theme object as a JSON string (see below) |

The **Theme JSON** property is a multiline text field. Paste the full JSON object there directly.


### 2. Set Theme name on every chart widget

Open each chart widget's property panel and fill in **Advanced > Theme name** with the exact same value you used in the loader (e.g. `atlas`).

Repeat for all Line, Bar, Pie, and Gauge chart widgets that should use the theme.


### 3. Provide the theme JSON

You have three options:

**A. Use the Atlas UI extractor tool** (recommended)

The package ships a Node.js CLI script at `tools/extract-echarts-theme.mjs` that reads your Atlas UI SCSS variables and generates a matching ECharts theme JSON.

Requirements: Node.js 18+, run from the widget source directory.

```bash
cd myPluggableWidgets/ECharts
node tools/extract-echarts-theme.mjs
```

By default the script reads the Atlas core base file:

```
<mendix-project>/themesource/atlas_core/web/themes/_theme-default.scss
```

and then layers project-level overrides on top (if present):

```
<mendix-project>/theme/web/custom-variables.scss
```

The result is written to:

```
tools/atlas-echarts-theme.json
```

Copy the contents of `atlas-echarts-theme.json` into the **Theme JSON** field of the Theme Loader widget.

Optional flags:

```bash
node tools/extract-echarts-theme.mjs \
  --scss path/to/custom/_theme.scss \
  --out  path/to/output.json
```


**B. Use the ECharts Theme Builder**

Go to [echarts.apache.org/en/theme-builder.html](https://echarts.apache.org/en/theme-builder.html), customize the colors, and download the JSON file. Paste its contents into the **Theme JSON** field.


**C. Write a theme object by hand**

A minimal theme object that sets a color palette looks like this:

```json
{
  "color": [
    "#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51",
    "#457b9d", "#a8dadc", "#f1faee", "#e63946", "#2b2d42"
  ],
  "backgroundColor": "transparent",
  "textStyle": {},
  "title": {
    "textStyle": { "color": "#264653" },
    "subtextStyle": { "color": "#aaaaaa" }
  },
  "line": { "itemStyle": { "borderWidth": 1 }, "lineStyle": { "width": 2 }, "smooth": false },
  "bar": { "itemStyle": { "barBorderWidth": 0, "barBorderColor": "#ccc" } },
  "pie": { "itemStyle": { "borderWidth": 0, "borderColor": "#ccc" } },
  "categoryAxis": {
    "axisLine": { "show": true, "lineStyle": { "color": "#aaaaaa" } },
    "axisLabel": { "show": true, "color": "#999999" },
    "splitLine": { "show": false, "lineStyle": { "color": ["#eeeeee"] } }
  },
  "valueAxis": {
    "axisLine": { "show": false, "lineStyle": { "color": "#aaaaaa" } },
    "axisLabel": { "show": true, "color": "#999999" },
    "splitLine": { "show": true, "lineStyle": { "color": ["#eeeeee"] } }
  },
  "tooltip": {
    "axisPointer": {
      "lineStyle": { "color": "#cccccc", "width": 1 },
      "crossStyle": { "color": "#cccccc", "width": 1 }
    }
  },
  "legend": { "textStyle": { "color": "#333333" } }
}
```

The `color` array defines the palette — ECharts cycles through it when assigning colors to series.

---

## Atlas UI color extraction — how it works

The extractor script (`tools/extract-echarts-theme.mjs`) reads CSS custom properties from the Atlas SCSS file. Atlas UI defines brand colors as hex values and derives shade variants using `color-mix()`:

```scss
--brand-primary: #264653;
--brand-success: #2a9d8f;
--brand-warning: #e9c46a;
--brand-danger:  #e76f51;
--gray:          #6c757d;
```

The script simulates the shade mixing and builds the ECharts palette from the 500-level shades of each brand color (primary, success, warning, danger, gray and their complementary tones). Axis, grid, and text styles are derived from the gray scale.

The output JSON can be pasted directly into the Theme Loader's **Theme JSON** field.

---

## Runtime behavior

When the application loads:

1. The Theme Loader widget stores the parsed theme in `window.__echartsThemeRegistry[themeName]` during its React render phase.
2. After the DOM is ready, it dispatches a `CustomEvent` named `echarts-theme-registered` on `window`, with `{ detail: { themeName } }`.
3. Each chart widget that has a matching **Theme name**:
   - Receives the event.
   - Reads the theme from the registry and calls `echarts.registerTheme()` on its own ECharts instance.
   - Disposes and reinitializes the chart, passing the theme name to `echarts.init()`.

If the Theme Loader is placed on a shared layout and loads before the chart widgets, the charts register the theme during their own initialization and no reinit is needed. The event mechanism handles the case where charts are already mounted when the loader first registers a theme.

---

## Tips

- **One loader, many charts** — a single Theme Loader on a layout covers all charts on all pages that use that layout.
- **Multiple themes** — you can have more than one Theme Loader on different layouts, each with a different theme name. Charts choose their theme via their **Theme name** property.
- **Theme name mismatch** — if the chart's **Theme name** does not exactly match the loader's **Theme name**, the chart uses ECharts' default theme silently.
- **Overriding per chart** — the **Custom chart option** JSON is merged after the theme is applied. Use it to override specific colors or styles for one chart without changing the global theme.
- **Transparent background** — set `"backgroundColor": "transparent"` in the theme JSON (or leave it out) so the chart blends with the Mendix page background.
