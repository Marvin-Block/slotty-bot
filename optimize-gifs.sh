#!/bin/bash
for filename in ./RouletteGifs/*.gif; do
	base_name=$(basename "$filename")

	new_name="Optimized-${base_name}"

	ffmpeg -y -i $filename -filter_complex "fps=30,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=32[p];[s1][p]paletteuse=dither=bayer" -loop -1 ./RouletteOptimized/$new_name
done