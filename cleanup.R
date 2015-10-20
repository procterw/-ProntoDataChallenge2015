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
unwantedColnames <- c("trip_id", "to_station_name","from_station_name","bikeid","birthyear")
trips <- trips[!(names(trips) %in% unwantedColnames)]

# These names can be shortened
trips$usertype <- gsub("Annual Member", "an", trips$usertype)
trips$usertype <- gsub("Short-Term Pass Holder", "st", trips$usertype)
trips$gender <- gsub("Male", "M", trips$gender)
trips$gender <- gsub("Female", "F", trips$gender)
trips$gender <- gsub("Other", "O", trips$gender)

since1970 <- as.POSIXct("1970-1-1 00:00:00")

trips$starttime <- unlist(lapply(trips$startime, convertToUnixTime))
trips$stoptime <- unlist(lapply(trips$stoptime, convertToUnixTime))
trips$tripduration <- trips$tripduration / 60

write.csv(trips, "clean_data/trips.csv", row.names=FALSE)


####################
### TRIPS cleanup
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
