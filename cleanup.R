# Script for cleaning and shrinking data files as much as possible.

library(lubridate)

setwd("~/projects/BikeShare/")

stations <- read.csv("open_data_year_one/2015_station_data.csv")
statuses <- read.csv("open_data_year_one/2015_status_data.csv")
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

test <- 

write.csv(trips, "open_data_year_one/cleaned/trips.csv")


####################
### TRIPS cleanup
####################

wantedColnames <- c("Date", "Mean_Temperature_F","Max_Wind_Speed_MPH","Mean_Wind_Speed_MPH","Events","Precipitation_In")
weather <- weather[(names(weather) %in% wantedColnames)]
weather$Date <- unlist(lapply(weather$Date, convertToUnixTime, "%m-%d-%Y"))

write.csv(weather, "open_data_year_one/cleaned/weather.csv")

####################
### STATIONS cleanup
####################

write.csv(stations, "open_data_year_one/cleaned/stations.csv")
