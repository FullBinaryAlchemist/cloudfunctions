import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
admin.initializeApp({
	storageBucket:'gs://securityapplication-b990e.appspot.com'
})

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
//const fs= require('fs')
export const testCount= functions.https.onRequest(async (req,res)=>{
	const callerUid=req.query.callerUid
	const targetUid=req.query.targetUid
	console.log(`${callerUid} called the https trigger. Sending message to victim_${targetUid}`)
	let payload,topic
	if(targetUid!==callerUid){
		console.log("caler is not target")
	payload={
		//send acknowledgement message to target
		data:{
			uid:targetUid,
			testCount:String(1),
		}
	}
	topic="victim_"+targetUid
	}
	else{
		console.log("caler is  target")
		//if target is caller then post the message to alerts_#zoneDeg_#subzoneMin to sendCount
		 payload={
		//send acknowledgement message to target
		data:{
			uid:targetUid,
			sendCount:String(1), //makes other devices send count
		}
	}
	 topic=req.query.topic || "notfound"
	}

	console.log("Topic for payload:"+topic)
	console.log(payload)

	await admin.messaging().sendToTopic(topic,payload)
	.catch(err=>{console.log("error:"+err)
				return res.status(500).send(err)
		})
	
	console.log(`Sent message to ${topic}`)
	return res.status(200).send("sent message to "+topic)
})

export const alertLocationOnUpdate = functions.database
.ref('/alerts/{uid}/location')
.onUpdate((change,context)=>{
	const uid= context.params.uid
	const location = change.after.val()
	console.log(`"${uid} was updated with location ${location}. Previous location ${change.before.val()}"`)
	//send data message with updated location
	const payload= {
		data:{
			uid:uid,
			liveLocation:location,
		}
	}
	console.log(payload)
	//return a Promise so that cloud functions wait till Promise is handled before cleaning-up
	const topic="saviours_"+uid			
	console.log("Topic received:"+topic+" type:"+typeof(topic))

	return admin.messaging().sendToTopic(topic, payload)
	.then((resp)=>{console.log("Data message dispatched:"+resp)})	

})

export const alertSavioursOnUpdate = functions.database
.ref('/alerts/{uid}/saviours/')
.onUpdate((change,context)=>{
	const uid= context.params.uid
	const saviourCount= Object.keys(change.after.val()).length
	console.log(`"Alert ${uid} was updated with Saviour count: ${saviourCount}."`)
	//send data message with updated location
	const payload= {
		data:{
			uid:uid,
			saviourCount:String(saviourCount),
		}
	}
	console.log(payload)
	//return a Promise so that cloud functions wait till Promise is handled before cleaning-up
	const topic="victim_"+uid			
	console.log("Topic received:"+topic+" type:"+typeof(topic))

	return admin.messaging().sendToTopic(topic, payload)
	.then((resp)=>{console.log("Count Update Data message dispatched:"+resp)})	

})

export const alertOnCreate = functions.database
.ref('/alerts/{uid}/')
.onCreate((snapshot,context)=>{
	const uid= context.params.uid
	const location = snapshot.val().location //gps co-ordinate in dd format separated by comma lat,lon
	const subzone= snapshot.val().subzone //subzone in subLong_subLat
	const zone= getzone(location) //return values as long_lat i.e. if (19.4,2.3) => 19_2

	console.log(`"${uid} was created with location ${location} with zone ${zone} subzone ${subzone}"`)
	const alertRef=snapshot.ref.parent
	if(alertRef!==null){
		const rootRef=alertRef.parent
		if(rootRef!==null)
		{
			const UsersRef= rootRef.child("Users")
			const username= UsersRef.child(uid).ref
			username.once("value").then(snashot => {
				console.log(`"Json of the user is ${snashot.val()}"`)
				const name=snashot.val().name
				//Method to retrieve all keys of a node :const keys= Object.keys(snashot.val())
				//console.log("keys"+keys)
				console.log("Name:"+name)

				//after name has been fetched send a message on that topic
				//a data message Notification 
				const payload= {
					notification:{
						title:"Emergency",
						body: name+" needs your help"
					},
					data:{
						username:name,
						uid:uid,
						liveLocation:location,
						//imageUrl: To be implemented
					}
				}
				console.log(payload)
				//return a Promise so that cloud functions wait till Promise is handled before cleaning-up
				var topic=getTopicString(zone,subzone)			
				console.log("Topic received:"+topic+" type:"+typeof(topic))
				console.log(getTopicString(zone,subzone))
				console.log('topic!=="alerts_72_19_52_17:"'+ topic!=="alerts_72_19_52_17")

				return admin.messaging().sendToTopic(topic, payload)	

			})
			.catch( err=>{console.log("error:"+err)})

		}
		else{
			console.log("RootRef not found")
		}
	}else{
		console.log("AlertRef not found")
	}
	return null
})

export const alertOnDelete= functions.database
.ref('/alerts/{uid}/')
.onDelete( async (snapshot,context)=>{
	const uid = context.params.uid
	const ts= snapshot.val().ts
	console.log("Alert by uid:"+uid+" with timestamp:"+ts+" was deleted")
	/*const bucket = admin.storage().bucket()
	const file=ts+".json"
	const path="/"+uid+"/"+"alerts"+"/"+file
	fs.writeFile(file,snapshot.exportVal(),function (err:any) {
		if (err) {return err;}
		console.log('File is created successfully.');
	})
	return bucket.upload(file,{
		destination:path
	})*/
	const rootRef= snapshot.ref.root
	if(rootRef!==null){
		try{
		await rootRef.child("alerthistory").push(snapshot.val()).child("uid").set(uid)
		}
		catch{
			console.log("Error when pushing history to firebase");
		}
		const UsersRef= rootRef.child("Users")
			const username= UsersRef.child(uid).ref
			username.once("value").then(snashot => {
				console.log(`"Json of the user is ${snashot.val()}"`)
				const name=snashot.val().name
				//Method to retrieve all keys of a node :const keys= Object.keys(snashot.val())
				//console.log("keys"+keys)
				console.log("Name:"+name)

				//after name has been fetched send a message on that topic
				//a data message Notification 
				const payload= {
					
					data:{
						username:name,
						uid:uid,
						safe:"true",
						//imageUrl: To be implemented
					}
				}
				console.log(payload)
				//return a Promise so that cloud functions wait till Promise is handled before cleaning-up
				var topic="saviours_"+uid			
				console.log("Topic received:"+topic+" type:"+typeof(topic))
				
				return admin.messaging().sendToTopic(topic, payload)	

			})
			.catch( err=>{console.log("error:"+err)})
	}

	
	//send message to saviours that the victim is now safe

	return null
})
//return values as (lat,long) as long_lat i.e. if (19.4,2.3) => 19_2
//input as dd gps string separated by comma i.e. "19.4,2.3"
function getzone(location:String){
	const split_zone= location.split(",")
	const lat_zone= String(parseInt(split_zone[0]))
	const long_zone= String(parseInt(split_zone[1]))
	return long_zone+"_"+lat_zone
}


function getTopicString(zone:string,subzone:string):string{
	const tpstr=`alerts_${zone}_${subzone}`
	console.log("topic string is:"+tpstr)
	return String(tpstr)
}