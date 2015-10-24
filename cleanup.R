# Script for cleaning and shrinking data files as much as possible.

library(lubridate)
library(maptools)

setwd("~/projects/BikeShare/")

stations <- read.csv("open_data_year_one/2015_station_data.csv")
# statuses <- read.csv("open_data_year_one/2015_status_data.csv")
trips <- read.csv("open_data_year_one/2015_trip_data.csv")
weather <- read.csv("open_data_year_one/2015_weather_data.csv")

convertToUnixTime <- function(time, format="%m-%d-%Y %H:%M:%S") {
  since1970 <- as.POSIXct("1970-1-1 00:00:00")
  time <- as.POSIXct(paste0(gsub("/", "-",time), ":00"), format=format)
  time <- as.numeric(difftime(time, since1970, units="mins"))
}


####################
### TRIPS cleanup
####################

# For this project we don't need any of this data
unwantedColnames <- c("trip_id", "to_station_name","from_station_name","bikeid","tripduration")
trips <- trips[!(names(trips) %in% unwantedColnames)]

# These names can be shortened
trips$usertype <- gsub("Annual Member", "A", trips$usertype)
trips$usertype <- gsub("Short-Term Pass Holder", "O", trips$usertype)
trips$gender <- gsub("Male", "M", trips$gender)
trips$gender <- gsub("Female", "F", trips$gender)
trips$gender <- gsub("Other", "O", trips$gender)

stationNames <- as.character(stations$terminal)
trips$from_station_id <- match(trips$from_station_id, stationNames)
trips$to_station_id <- match(trips$to_station_id, stationNames)

since1970 <- as.POSIXct("1970-1-1 00:00:00")

trips$starttime <- as.numeric(difftime(as.POSIXct(as.character(trips$starttime), format="%m/%d/%Y %H:%M"), 
                 since1970, units="mins"))

trips$stoptime <- as.numeric(difftime(as.POSIXct(as.character(trips$stoptime), format="%m/%d/%Y %H:%M"), 
                            since1970, units="mins"))

write.csv(trips, "clean_data/trips.csv", row.names=FALSE)


####################
### WEATHER cleanup
####################

wantedColnames <- c("Date", "Mean_Temperature_F","Max_Wind_Speed_MPH","Mean_Wind_Speed_MPH","Events","Precipitation_In")
weather <- weather[(names(weather) %in% wantedColnames)]
weather$Date <- unlist(lapply(weather$Date, convertToUnixTime, "%m-%d-%Y"))

write.csv(weather, "clean_data/weather.csv", row.names=FALSE)

####################
### STATIONS cleanup
####################

write.csv(stations, "clean_data/stations.csv", row.names=FALSE)

#####################
### SUN POSITIONS
#####################

# General location of seattle
seattle <- SpatialPoints(matrix(c(-122.33, 47.61),nrow=1), proj4string=CRS("+proj=longlat +datum=26910"))

# Time sequence of interest
timeRange <- seq(ymd("2014-10-12", tz="US/Pacific"), 
                 ymd("2015-10-12"), tz="US/Pacific", 
                 by="day")

# Find sunrises as POSIXct
sunrises <- sunriset(seattle, direction="sunrise", dateTime=timeRange, POSIXct.out=TRUE)

# Find sunrises as POSIXct
sunsets <- sunriset(seattle, direction="sunset", dateTime=timeRange, POSIXct.out=TRUE)

sunrisesunset <- data.frame(date=strftime(sunrises$time, format="%Y-%m-%d"),
           sunrise=strftime(sunrises$time, format="%H:%M:%S"),
           sunset=strftime(sunsets$time, format="%H:%M:%S"))

write.csv(sunrisesunset, "clean_data/sunriset.csv", row.names=FALSE)






#####################
### STATUSES CLEANUP
#####################

# Convert unique times to POSIXct
statusTimes <- as.POSIXct(unique(statuses$time), format="%Y-%m-%d %H:%M:%S")

# Create an hourly sequence of dates
d1 <- as.POSIXct("2014-10-16")
d2 <- as.POSIXct("2015-10-12")
hourlySeq <- seq(d1,d2,by="hour")

# Merge the times and sort
mergedTimes <- sort(c(statusTimes, hourlySeq))

# Indices where our hourly mask is now
hourlyMask <- which(mergedTimes %in% hourlySeq)

# Only use hourly intervals that have actual times between them
hourlyDiffs <- hourlyMask[which(diff(hourlyMask) > 1)]

# The actual times and rounded times we'll be using
realTimes <- mergedTimes[hourlyDiffs - 1]
roundedTimes <- mergedTimes[hourlyDiffs]

# Now that we have the closest times, subset the original statuses with
# those times
statusSubset <- statuses[which(as.character(statuses$time) %in% as.character(realTimes)),]

# Replace the time with the corresponding rounded time
statusSubset$time <- roundedTimes[match(as.character(statusSubset$time), as.character(realTimes))]

# TODO is this the right approach?
# Combine available bikes and bikes_blocked
statusSubset$bikes <- statusSubset$bikes_available + statusSubset$bikes_blocked

# New data frame which shows missing values for stations
# instead of not including them
fullStatuses <- expand.grid(1:max(statuses$station_id),roundedTimes)
names(fullStatuses) <- c("station_id", "time")

# Merge the two dataframes. This will fill in missing values for
# statusSubset
fullStatuses <- merge(fullStatuses, statusSubset, all.x=TRUE)
fullStatuses <- fullStatuses[with(fullStatuses, order(time, station_id)),]

# Write to csv
write.csv(fullStatuses$bikes, "clean_data/statuses.csv", row.names=FALSE)
