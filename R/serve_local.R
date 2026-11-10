# Preview the website on your computer --------------------------------------
# The pages load the CSV/JSON files with fetch(), which browsers block when
# you open index.html directly (file://). A small local server avoids that.
#
# install.packages("servr")   # once
servr::httd(".", port = 4321, browser = TRUE)
# Stop the server with servr::daemon_stop() or by restarting R.
