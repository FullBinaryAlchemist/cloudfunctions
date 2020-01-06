import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
admin.initializeApp()

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const alertOnUpdate = functions.database
.ref('/alerts/{uid}/')
.onUpdate((change,context)=>{
	const uid= context.params.uid
	const location = change.after.val()
	console.log(`"${uid} was updated with location ${location}"`)
	return null
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
				const topic=getTopicString(zone,subzone)
				console.log("Topic received:"+topic)
				return admin.messaging().sendToTopic("alerts_72_19_24_34", payload)	

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

//return values as (lat,long) as long_lat i.e. if (19.4,2.3) => 19_2
//input as dd gps string separated by comma i.e. "19.4,2.3"
function getzone(location:String){
	const split_zone= location.split(",")
	const lat_zone= String(parseInt(split_zone[0]))
	const long_zone= String(parseInt(split_zone[1]))
	return long_zone+"_"+lat_zone
}


function getTopicString(zone:string,subzone:string):string{
	const tpstr=`"/topics/alerts_${zone}_${subzone}"`
	console.log("topic string is:"+tpstr)
	return tpstr
}