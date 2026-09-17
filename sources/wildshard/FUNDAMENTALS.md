## Project wildshard fundamentals

 - Mega grid highway between all the chunks, chunk size is arbitrary but lets say that chunks are 500m by 500m by 200m ( 100m underground, 100m in the sky ) and then there is a highway of 15m wide 

 - Then the world costs of these full on grid with highways between each chunks, so if we have for example 5 x 5 grid deployed and implemented, it would be like 25 chunks, with one in the center, and then going out 2 on all sides. there would be a massive grid road system, on the edges of all the chunks thats a nomans land owned by the game server.

 - To enter chunks, in the middle at 250m point, you need to have a 15m wide road that goes in at least 50m into the chunk, do this at all four midpoints, which means that for 15m wide at the chunk boundary, the terrain must be level with the nomans land, you cant build a massive wall or cliff on one or all of teh deges, the road must always be able to enter into the chunk.

 - The center chunk is hardcoded in the game and cant be edited without bumping or changing the game server.

 - All other chunks are developed locally, and uploaded to the server using the skill/api/cli. 

 - Uploading a chunk as a zipfile includes geometry, npcs, quests scripts, custom parameteized items like weapons and equipments. 

 - The zipfile for a chunk is a MEGA validated format, its very specific, and it has hard limits to avoid griefing or reduce performance issues, abd adding custom things beyond geometry follows a very specific format that the server must be able to load as config without loading arbirtrary code stuff.

 - Every chunk should have a host. There is a server hosting it, a chunk can be in a server and a room. Most of the original chunks are hosted in the main server.

 - Every chunk has an original author, and has a last edited by, chunks can be private or public, there is some locking / grace period to avoid thrashing chunks

 - When building a new chunk you do in isolation, as like a floating cube, and after uploading it to the server then you see where it gets popped in to the main infinite world, you dont choose to develop a chunk in a certain location.

 - Locking, grace periods, public vs private, 

 - I want other people to be able to collaborate and edit chunks together, and I want old chunks to be able to be renovated by new people. We could GC chunks and allow them to be claimed by a new owner ? 

 - To avoid the center of the world being a ghost town of early playtesters, instead of having editable / public / multi user chunks, bin pack and GC chunks and basically move chunks around based on last edited or last played, or most active. Chunks can be measured on popularity by edits / uploads or by interacting with custom content like achievements, puzzles, quests, item pickups.

 - The ability to invite other people to edit your chunk is still a good idea, they have to download the current version fo the chunk to be able to edit it cleanly with claude code.

 - The chunk uploading UI should be a really cool in game feature, you dont upload a chunk with claude code or CLI or API, you upload it by running the game in localhost mode, planting a flag or a beacon in the 8 corners of the chunk, and then planting the 9th beacon in the very center of the chunk and like doing the 30second "cool upload animation / action" 

 - When chunks get updated how does that stream into the existing people in the server, do all the people float into the sky in that chunk do they get a "new chunk incoming warning" do they get told they have 5 minutes to like leave the chunk or they will get teleported to the very center 
