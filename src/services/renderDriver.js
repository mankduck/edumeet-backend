import { google } from "googleapis";


const auth = new google.auth.GoogleAuth({

    keyFile:"google-service-account.json",

    scopes:[
        "https://www.googleapis.com/auth/drive.readonly"
    ]

});


const drive = google.drive({
    version:"v3",
    auth
});


export async function getDriveFile(fileId,res){


    const file = await drive.files.get({

        fileId,

        fields:"name,mimeType"

    });


    res.setHeader(
        "Content-Type",
        file.data.mimeType
    );


    const response = await drive.files.get({

        fileId,

        alt:"media"

    },{
        responseType:"stream"
    });



    response.data.pipe(res);

}