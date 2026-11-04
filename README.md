Project Synopsis

## Project Title : Closet – Smart Digital Wardrobe and Outfit Planner

## Problem Statement:
Outfit Decision Fatigue
Most people own plenty of clothes but still struggle every day to decide what to wear. Choosing colour combinations that match, dressing right for the occasion and weather, and remembering what is actually in the wardrobe takes time and often ends in repeating the same few safe outfits.

Forgotten Wardrobe & Lack of Styling Support
A large part of every wardrobe goes unworn because pieces are forgotten or people are unsure how to style them. There is no simple, personal tool that knows a person's own clothes, tracks what they wear, and suggests well-matched outfits from what they already own, creating a need for a digital wardrobe with smart outfit suggestions.

## Objectives:
1.	To build a digital wardrobe where users can store their own clothes with a photo, type, colour, fit, occasion and weather details.
2.	To automatically suggest complete outfits from the user's own clothes based on the chosen occasion and the weather.
3.	To apply colour-harmony and fit-balance rules (Harmony Logic) so that suggested outfits are well matched and explained in simple words.
4.	To track how often and how recently each piece is worn, and use this to bring forgotten clothes back into use (Magic Mix).
5.	To design an attractive, interactive and mobile-friendly interface with a login page, smooth animations and an illustrated wardrobe view.
6.	To support future enhancements such as cloud accounts, an AI stylist and a weekly outfit planner.

## Scope of the Project:
1.	User sign-up and login (browser-based demo authentication)
2.	Adding, editing and removing clothing items with photos and automatic colour detection
3.	Outfit suggestions by occasion (Casual, Office, Party, Ethnic / festive, Date, Gym) and weather (Hot, Pleasant, Cold, Rainy)
4.	Live weather detection using the user's location
5.	Wear tracking, "In the wash" status, saved outfits and outfit sharing as an image
6.	Search, filters and sorting of the wardrobe, plus backup and restore of wardrobe data
7.	Responsive design for laptop and mobile, including light and dark mode

## Data Description:
Closet does not use an external dataset. All data is created by the user inside the app and stored in the browser's localStorage on the user's device. Each clothing item stores a name, photo (compressed), type (top, bottom, dress, ethnic set, layer, shoes, accessory), colour, fit (slim, regular, loose), suitable occasions, suitable weather, wear count, last-worn date, "in the wash" status and date added.
The app also stores a wear log (which outfit was worn on which day), saved outfits and user preferences. Live weather data (current temperature, rainfall and weather code) is fetched from the free Open-Meteo API using the user's approximate location, only when the user chooses "Use today's weather". Users can export all their wardrobe data as a JSON backup file and restore it on another device.

## Tool and Technologies Used:
1.	HTML5
2.	CSS3 (animations, frosted-glass design, responsive layout)
3.	JavaScript (ES6)
4.	Browser localStorage
5.	Canvas API, Geolocation API and Web Share API
6.	Open-Meteo Weather API
7.	Google Fonts (Bodoni Moda, Jost)
8.	Visual Studio Code with Live Server
9.	Git and GitHub
10.	Netlify (hosting)

## Key Performance Indicators (KPIs):
1.	Total Pieces in Wardrobe
2.	Pieces Not Worn in the Last 30 Days
3.	Pieces Currently in the Wash
4.	Total Outfit Combinations Found
5.	Wear Count per Piece
6.	Days Since Last Worn per Piece
7.	Total Saved Outfits
8.	Outfits Marked as Worn per Week
9.	New Outfits Unlocked by Adding One Piece (Complete the Look)
10.	Wardrobe Usage Rate (share of pieces worn in a month)
11.	Pieces by Type and Colour
12.	Active Users and Repeat Visits (after launch)

## Expected Outcome:
1.	A working digital wardrobe where users can store and manage all their clothes in one place.
2.	Quick, well-matched outfit suggestions for any occasion and weather, each with a short reason.
3.	Less repetition and better use of the existing wardrobe by bringing forgotten clothes back into rotation.
4.	Clear insights for the user, such as which pieces are rarely worn and which single new piece would create the most new outfits.
5.	An attractive, easy-to-use web app that works on both laptop and mobile and can be shared with others through a link.
6.	A strong foundation for future enhancements such as cloud sync with Firebase, an AI stylist and a weekly outfit planner.

## Conclusion:
This project successfully develops Closet, a smart digital wardrobe that helps users decide what to wear using the clothes they already own. By combining colour-harmony rules, fit balance, occasion and weather filters, and wear-history tracking, the app suggests complete outfits and encourages the use of forgotten pieces.
The interactive interface, with its illustrated wardrobe, smooth animations and mobile-friendly design, makes managing clothes simple and enjoyable. Although the current prototype stores data only in the browser and uses demo authentication, it provides a complete, working foundation for real accounts, cloud sync and AI-based styling.
Overall, the project demonstrates how everyday personal data can be turned into practical, personalised recommendations using web technologies.

https://github.com/RohitK800/Closet-app-development

## Architecture Diagram

![Architecture Diagram](docs/architecture.png)
