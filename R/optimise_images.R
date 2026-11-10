# Compress new photos before adding them to the website -------------------
# Large PNG photos (1-2 MB) load slowly on mobile data. This script converts
# every image in `originals/` to:
#   assets/img/<name>.jpg     (1600 px wide, for page headers)
#   assets/img/<name>-sm.jpg  (800 px wide, for the gallery)
#
# install.packages("magick")   # once
library(magick)

in_dir  <- "originals"      # put the original photos here (not pushed to GitHub)
out_dir <- "assets/img"

files <- list.files(in_dir, pattern = "\\.(png|jpe?g)$", ignore.case = TRUE, full.names = TRUE)

for (f in files) {
  name <- tools::file_path_sans_ext(basename(f))
  img  <- image_read(f) |> image_trim(fuzz = 10) |> image_background("white") |> image_flatten()
  img |> image_resize("1600x1600>") |>
    image_write(file.path(out_dir, paste0(name, ".jpg")), format = "jpeg", quality = 78)
  img |> image_resize("800x800>") |>
    image_write(file.path(out_dir, paste0(name, "-sm.jpg")), format = "jpeg", quality = 75)
  message("Done: ", name)
}
