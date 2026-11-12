// Country + capital data. `E(country, capital, alt country names, alt capital names, subregion)`.
export const CONT_NAMES=["Africa","Europe","Asia","North America","South America","Oceania"] as const;
export type ContinentName=typeof CONT_NAMES[number];

export interface Country{k:string;c:string;ak:string[];ac:string[];r?:string;cn:ContinentName}
type Entry=Omit<Country,"cn">;
const E=(k:string,c:string,ak:string[]=[],ac:string[]=[],r?:string):Entry=>({k,c,ak,ac,r});

const RAW:Record<ContinentName,Entry[]>={
 Africa:[
  E("Morocco","Rabat",[],[],"North"),E("Algeria","Algiers",[],[],"North"),E("Tunisia","Tunis",[],[],"North"),E("Libya","Tripoli",[],[],"North"),E("Egypt","Cairo",[],[],"North"),E("Sudan","Khartoum",[],[],"North"),
  E("Mauritania","Nouakchott",[],[],"West"),E("Senegal","Dakar",[],[],"West"),E("The Gambia","Banjul",["Gambia"],[],"West"),E("Cabo Verde","Praia",["Cape Verde"],[],"West"),E("Guinea-Bissau","Bissau",[],[],"West"),E("Guinea","Conakry",[],[],"West"),E("Sierra Leone","Freetown",[],[],"West"),E("Liberia","Monrovia",[],[],"West"),E("Côte d'Ivoire","Yamoussoukro",["Ivory Coast"],["Abidjan"],"West"),E("Ghana","Accra",[],[],"West"),E("Togo","Lomé",[],[],"West"),E("Benin","Porto-Novo",[],["Cotonou"],"West"),E("Nigeria","Abuja",[],[],"West"),E("Niger","Niamey",[],[],"West"),E("Mali","Bamako",[],[],"West"),E("Burkina Faso","Ouagadougou",[],[],"West"),
  E("Chad","N'Djamena",[],[],"Central"),E("Cameroon","Yaoundé",[],[],"Central"),E("Central African Republic","Bangui",["CAR"],[],"Central"),E("Equatorial Guinea","Ciudad de la Paz",[],["Malabo"],"Central"),E("Gabon","Libreville",[],[],"Central"),E("São Tomé and Príncipe","São Tomé",["Sao Tome"],[],"Central"),E("Rep. of the Congo","Brazzaville",["Republic of the Congo","Congo-Brazzaville","Congo"],[],"Central"),E("DR Congo","Kinshasa",["DRC","Democratic Republic of the Congo","Congo-Kinshasa"],[],"Central"),E("Angola","Luanda",[],[],"Central"),
  E("Eritrea","Asmara",[],[],"East"),E("Djibouti","Djibouti",[],[],"East"),E("Ethiopia","Addis Ababa",[],[],"East"),E("South Sudan","Juba",[],[],"East"),E("Somalia","Mogadishu",[],[],"East"),E("Uganda","Kampala",[],[],"East"),E("Kenya","Nairobi",[],[],"East"),E("Rwanda","Kigali",[],[],"East"),E("Burundi","Gitega",[],["Bujumbura"],"East"),E("Tanzania","Dodoma",[],["Dar es Salaam"],"East"),E("Seychelles","Victoria",[],[],"East"),E("Comoros","Moroni",[],[],"East"),E("Madagascar","Antananarivo",[],[],"East"),E("Mauritius","Port Louis",[],[],"East"),
  E("Malawi","Lilongwe",[],[],"Southern"),E("Zambia","Lusaka",[],[],"Southern"),E("Zimbabwe","Harare",[],[],"Southern"),E("Mozambique","Maputo",[],[],"Southern"),E("Namibia","Windhoek",[],[],"Southern"),E("Botswana","Gaborone",[],[],"Southern"),E("South Africa","Pretoria",[],["Cape Town","Bloemfontein"],"Southern"),E("Eswatini","Mbabane",["Swaziland"],["Lobamba"],"Southern"),E("Lesotho","Maseru",[],[],"Southern")
 ],
 Europe:[
  E("Albania","Tirana"),E("Andorra","Andorra la Vella"),E("Austria","Vienna"),E("Belarus","Minsk"),E("Belgium","Brussels"),E("Bosnia and Herzegovina","Sarajevo",["Bosnia"]),E("Bulgaria","Sofia"),E("Croatia","Zagreb"),E("Cyprus","Nicosia"),E("Czechia","Prague",["Czech Republic"]),E("Denmark","Copenhagen"),E("Estonia","Tallinn"),E("Finland","Helsinki"),E("France","Paris"),E("Germany","Berlin"),E("Greece","Athens"),E("Hungary","Budapest"),E("Iceland","Reykjavik"),E("Ireland","Dublin"),E("Italy","Rome"),E("Latvia","Riga"),E("Liechtenstein","Vaduz"),E("Lithuania","Vilnius"),E("Luxembourg","Luxembourg City",[],["Luxembourg"]),E("Malta","Valletta"),E("Moldova","Chișinău",[],["Chisinau"]),E("Monaco","Monaco"),E("Montenegro","Podgorica"),E("Netherlands","Amsterdam",["Holland"]),E("North Macedonia","Skopje",["Macedonia"]),E("Norway","Oslo"),E("Poland","Warsaw"),E("Portugal","Lisbon"),E("Romania","Bucharest"),E("Russia","Moscow"),E("San Marino","San Marino"),E("Serbia","Belgrade"),E("Slovakia","Bratislava"),E("Slovenia","Ljubljana"),E("Spain","Madrid"),E("Sweden","Stockholm"),E("Switzerland","Bern",[],["Berne"]),E("Ukraine","Kyiv",[],["Kiev"]),E("United Kingdom","London",["UK","Britain","Great Britain"]),E("Vatican City","Vatican City",["Vatican","Holy See"])
 ],
 Asia:[
  E("Afghanistan","Kabul"),E("Armenia","Yerevan"),E("Azerbaijan","Baku"),E("Bahrain","Manama"),E("Bangladesh","Dhaka"),E("Bhutan","Thimphu"),E("Brunei","Bandar Seri Begawan"),E("Cambodia","Phnom Penh"),E("China","Beijing",[],["Peking"]),E("Georgia","Tbilisi"),E("India","New Delhi",[],["Delhi"]),E("Indonesia","Jakarta"),E("Iran","Tehran"),E("Iraq","Baghdad"),E("Israel","Jerusalem"),E("Japan","Tokyo"),E("Jordan","Amman"),E("Kazakhstan","Astana",[],["Nur-Sultan"]),E("Kuwait","Kuwait City"),E("Kyrgyzstan","Bishkek"),E("Laos","Vientiane"),E("Lebanon","Beirut"),E("Malaysia","Kuala Lumpur"),E("Maldives","Malé",[],["Male"]),E("Mongolia","Ulaanbaatar",[],["Ulan Bator"]),E("Myanmar","Naypyidaw",["Burma"],["Nay Pyi Taw"]),E("Nepal","Kathmandu"),E("North Korea","Pyongyang"),E("Oman","Muscat"),E("Pakistan","Islamabad"),E("Palestine","Ramallah",[],["East Jerusalem"]),E("Philippines","Manila"),E("Qatar","Doha"),E("Saudi Arabia","Riyadh"),E("Singapore","Singapore"),E("South Korea","Seoul"),E("Sri Lanka","Sri Jayawardenepura Kotte",[],["Kotte","Colombo"]),E("Syria","Damascus"),E("Tajikistan","Dushanbe"),E("Thailand","Bangkok"),E("Timor-Leste","Dili",["East Timor"]),E("Turkey","Ankara",["Türkiye","Turkiye"]),E("Turkmenistan","Ashgabat"),E("United Arab Emirates","Abu Dhabi",["UAE"]),E("Uzbekistan","Tashkent"),E("Vietnam","Hanoi"),E("Yemen","Sana'a",[],["Sanaa"])
 ],
 "North America":[
  E("Antigua and Barbuda","St. John's",[],["Saint John's"]),E("Bahamas","Nassau",["The Bahamas"]),E("Barbados","Bridgetown"),E("Belize","Belmopan"),E("Canada","Ottawa"),E("Costa Rica","San José",[],["San Jose"]),E("Cuba","Havana"),E("Dominica","Roseau"),E("Dominican Republic","Santo Domingo"),E("El Salvador","San Salvador"),E("Grenada","St. George's",[],["Saint George's"]),E("Guatemala","Guatemala City"),E("Haiti","Port-au-Prince"),E("Honduras","Tegucigalpa"),E("Jamaica","Kingston"),E("Mexico","Mexico City"),E("Nicaragua","Managua"),E("Panama","Panama City"),E("Saint Kitts and Nevis","Basseterre",["St. Kitts and Nevis"]),E("Saint Lucia","Castries",["St. Lucia"]),E("Saint Vincent and the Grenadines","Kingstown",["St. Vincent and the Grenadines"]),E("Trinidad and Tobago","Port of Spain"),E("United States","Washington, D.C.",["USA","US","United States of America"],["Washington","Washington DC"])
 ],
 "South America":[
  E("Argentina","Buenos Aires"),E("Bolivia","Sucre",[],["La Paz"]),E("Brazil","Brasília",[],["Brasilia"]),E("Chile","Santiago"),E("Colombia","Bogotá",[],["Bogota"]),E("Ecuador","Quito"),E("Guyana","Georgetown"),E("Paraguay","Asunción",[],["Asuncion"]),E("Peru","Lima"),E("Suriname","Paramaribo"),E("Uruguay","Montevideo"),E("Venezuela","Caracas")
 ],
 Oceania:[
  E("Australia","Canberra"),E("Fiji","Suva"),E("Kiribati","Tarawa",[],["South Tarawa"]),E("Marshall Islands","Majuro"),E("Micronesia","Palikir"),E("Nauru","Yaren"),E("New Zealand","Wellington"),E("Palau","Ngerulmud"),E("Papua New Guinea","Port Moresby"),E("Samoa","Apia"),E("Solomon Islands","Honiara"),E("Tonga","Nuku'alofa",[],["Nukualofa"]),E("Tuvalu","Funafuti"),E("Vanuatu","Port Vila")
 ]
};

export const CONT=Object.fromEntries(CONT_NAMES.map(cn=>[cn,RAW[cn].map(d=>({...d,cn}) as Country)])) as Record<ContinentName,Country[]>;
export const DATA:Country[]=CONT_NAMES.flatMap(cn=>CONT[cn]);
export const dataByName:Record<string,Country>=Object.fromEntries(DATA.map(d=>[d.k,d]));

// atlas name -> data name where they differ
export const ATLAS_ALIAS:Record<string,string>={"Bosnia and Herz.":"Bosnia and Herzegovina","Central African Rep.":"Central African Republic","Dem. Rep. Congo":"DR Congo","Dominican Rep.":"Dominican Republic","Eq. Guinea":"Equatorial Guinea","eSwatini":"Eswatini","Gambia":"The Gambia","Macedonia":"North Macedonia","Congo":"Rep. of the Congo","S. Sudan":"South Sudan","Vatican":"Vatican City","Marshall Is.":"Marshall Islands","São Tomé and Principe":"São Tomé and Príncipe","St. Vin. and Gren.":"Saint Vincent and the Grenadines","St. Kitts and Nevis":"Saint Kitts and Nevis","Antigua and Barb.":"Antigua and Barbuda","Solomon Is.":"Solomon Islands","United States of America":"United States"};
// map shapes that are not drilled, assigned to a continent for highlighting only
export const TERRITORY:Record<string,string>={"W. Sahara":"Africa","Somaliland":"Africa","Kosovo":"Europe","N. Cyprus":"Europe","Taiwan":"Asia","Greenland":"North America","Puerto Rico":"North America","U.S. Virgin Is.":"North America","Anguilla":"North America","Cayman Is.":"North America","Bermuda":"North America","British Virgin Is.":"North America","Turks and Caicos Is.":"North America","Montserrat":"North America","Aruba":"North America","Curaçao":"North America","St. Pierre and Miquelon":"North America","St-Martin":"North America","St-Barthélemy":"North America","Sint Maarten":"North America","Falkland Is.":"South America","New Caledonia":"Oceania","Fr. S. Antarctic Lands":"Antarctica","Antarctica":"Antarctica"};


// approximate [lon, lat] for countries too small to exist in the 110m map
export const MARK:Record<string,[number,number]>={"Cabo Verde":[-23.5,15.0],"São Tomé and Príncipe":[6.7,0.3],"Seychelles":[55.5,-4.7],"Comoros":[43.3,-11.7],"Mauritius":[57.5,-20.2],
 "Andorra":[1.55,42.55],"Liechtenstein":[9.55,47.15],"Malta":[14.4,35.9],"Monaco":[7.4,43.74],"San Marino":[12.45,43.94],"Vatican City":[12.45,41.9],
 "Bahrain":[50.55,26.05],"Maldives":[73.5,3.2],"Singapore":[103.8,1.35],
 "Antigua and Barbuda":[-61.8,17.1],"Barbados":[-59.55,13.2],"Dominica":[-61.35,15.4],"Grenada":[-61.7,12.1],"Saint Kitts and Nevis":[-62.75,17.35],"Saint Lucia":[-60.98,13.9],"Saint Vincent and the Grenadines":[-61.2,13.2],
 "Kiribati":[173,1.4],"Marshall Islands":[171,7.1],"Micronesia":[158.2,6.9],"Nauru":[166.9,-0.53],"Palau":[134.6,7.5],"Samoa":[-172.2,-13.8],"Tonga":[-175.2,-21.2],"Tuvalu":[179.2,-8.5]};
// bounding corners used to frame each continent in the drill map
export const MINI:Record<string,[number,number][]>={
 Africa:[[-26,38],[60,38],[60,-36],[-26,-36]],
 Europe:[[-26,71],[45,71],[45,34],[-26,34]],
 Asia:[[25,-11],[146,-11],[146,55],[25,55]],
 "North America":[[-170,6],[-50,6],[-50,72],[-170,72]],
 "South America":[[-82,13],[-34,13],[-34,-56],[-82,-56]],
 Oceania:[[110,12],[-150,12],[-150,-48],[110,-48]]
};
export const MINI_ROT:Record<string,[number,number]>={Oceania:[-150,0]};
