#!/usr/bin/env python3
"""
Generates benchmark graph using matplotlib xkcd() style.
This produces genuinely hand-drawn looking curves with wobbly lines,
hand-lettered fonts, and sketch aesthetics — not AI-polished SVG.
"""

import os
import sys

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import numpy as np
except ImportError:
    print("Installing matplotlib...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "matplotlib", "numpy", "--break-system-packages", "-q"])
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import numpy as np


def main():
    x = np.array([1, 10, 25, 50, 75, 100])

    # p95 latency in ms for each system at each concurrency level
    agentgate  = np.array([32,  34,  38,  44,  51,  58])
    llama      = np.array([285, 340, 510, 740, 1040, 1350])
    claude     = np.array([1150, 1220, 1380, 1620, 1880, 2150])
    gpt        = np.array([1420, 1480, 1650, 1900, 2200, 2480])

    with plt.xkcd(scale=1.2, length=150, randomness=2):
        fig, ax = plt.subplots(figsize=(11, 5.5))
        fig.patch.set_facecolor("#fafafa")
        ax.set_facecolor("#fafafa")

        # Plot lines
        ax.plot(x, gpt,       color="#e53e3e", linewidth=2.2, label="GPT-4o-mini (API)")
        ax.plot(x, claude,    color="#d97706", linewidth=2.2, label="Claude 3.5 Haiku (API)")
        ax.plot(x, llama,     color="#7c3aed", linewidth=2.2, label="Llama Guard 3 (1B vLLM)")
        ax.plot(x, agentgate, color="#16a34a", linewidth=2.8, label="AgentGate (0.8B Clef)")

        # Data point markers
        ax.scatter(x, gpt,       color="#e53e3e", s=40, zorder=5)
        ax.scatter(x, claude,    color="#d97706", s=40, zorder=5)
        ax.scatter(x, llama,     color="#7c3aed", s=40, zorder=5)
        ax.scatter(x, agentgate, color="#16a34a", s=55, zorder=5)

        # End-point callout labels
        ax.annotate("2,480ms", xy=(100, 2480), xytext=(102, 2430),
                    fontsize=9, color="#e53e3e", fontweight="bold")
        ax.annotate("2,150ms", xy=(100, 2150), xytext=(102, 2090),
                    fontsize=9, color="#d97706", fontweight="bold")
        ax.annotate("1,350ms", xy=(100, 1350), xytext=(102, 1290),
                    fontsize=9, color="#7c3aed", fontweight="bold")
        ax.annotate("58ms",    xy=(100, 58),   xytext=(102, 130),
                    fontsize=9, color="#16a34a", fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color="#16a34a", lw=1.2))

        # Annotation: AgentGate flatline
        ax.annotate(
            "flat line — single forward pass\nno KV-cache, no autoregression",
            xy=(50, 44), xytext=(30, 350),
            fontsize=9, color="#166534",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="#dcfce7", edgecolor="#16a34a", lw=1.2),
            arrowprops=dict(arrowstyle="->", color="#16a34a", lw=1.2,
                            connectionstyle="arc3,rad=0.2")
        )

        # Annotation: divergence label
        ax.annotate(
            "sequential token decoding\nlatency scales with load",
            xy=(75, 2200), xytext=(42, 2050),
            fontsize=9, color="#92400e",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="#fef9c3", edgecolor="#d97706", lw=1.2),
            arrowprops=dict(arrowstyle="->", color="#d97706", lw=1.2,
                            connectionstyle="arc3,rad=-0.2")
        )

        # Axis labels + title
        ax.set_xlabel("Concurrent Tool Calls (Load)", fontsize=11, labelpad=8)
        ax.set_ylabel("p95 Latency (ms)", fontsize=11, labelpad=8)
        ax.set_title("p95 Latency vs. Concurrent Request Load", fontsize=14, pad=14)

        # Axis ticks
        ax.set_xticks([1, 10, 25, 50, 75, 100])
        ax.set_xlim(0, 112)
        ax.set_ylim(-50, 2700)
        ax.set_yticks([0, 500, 1000, 1500, 2000, 2500])
        ax.yaxis.set_major_formatter(
            matplotlib.ticker.FuncFormatter(lambda v, _: f"{int(v):,}ms")
        )

        # Legend
        ax.legend(loc="upper left", fontsize=9.5, framealpha=0.7,
                  edgecolor="#ccc", facecolor="#fafafa")

        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

        plt.tight_layout()

        target_docs = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "docs", "images", "benchmark_graph.svg")
        )
        target_hf = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "decision", "qwen-decisions", "benchmark_graph.svg")
        )

        plt.savefig(target_docs, format="svg", bbox_inches="tight", dpi=150)
        plt.savefig(target_hf,   format="svg", bbox_inches="tight", dpi=150)
        print(f"Generated: {target_docs}")
        print(f"Generated: {target_hf}")


if __name__ == "__main__":
    main()
