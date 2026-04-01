![ConventSystems](https://github.com/LuchKlooster/MendixConventECharts/blob/main/docs/images/CS64x64.png)............![ECharts](https://github.com/LuchKlooster/MendixConventECharts/blob/main/docs/images/EChartsLogo.png)

**ConventECharts** is a collection of high-quality, data-driven chart widgets for Mendix, built on top of [Apache ECharts](https://echarts.apache.org/) v5. ECharts is a mature, production-ready charting library used worldwide, offering smooth animations, rich interactivity (tooltips, zoom, click events), and exceptional rendering performance via an HTML5 canvas.

The package ships five widgets:

| Widget | Use case |
| --- | --- |
| ECharts Line chart | Trends over time, comparisons between series |
| ECharts Bar chart | Category comparisons, vertical or horizontal |
| ECharts Pie / Donut chart | Part-to-whole relationships |
| ECharts Gauge chart | Speedometer / multi-needle gauge; up to 3 independent series on one dial |
| ECharts Theme Loader | Registers an ECharts color theme so all chart widgets on the page use your application's brand colors |

All widgets share a consistent design: connect a Mendix data source, map attributes, and optionally fine-tune with a JSON override — no custom JavaScript required.

Theme support lets every chart pick up the colors, fonts, and axis styles of your Mendix Atlas UI theme automatically. See **[docs/theming.md](docs/theming.md)** for a complete guide.

A demo Mendix project is available at **[github.com/LuchKlooster/MendixConventEChartsDemo](https://github.com/LuchKlooster/MendixConventEChartsDemo)**.    
Demo project is live to be seen at **[https://echartsdemo100-sandbox.mxapps.io/index.html](https://echartsdemo100-sandbox.mxapps.io/index.html)**.

