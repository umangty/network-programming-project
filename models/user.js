var mongoose = require('mongoose')
mongoose.Promise = require('bluebird');
var moment = require('moment')
var Project = require('./project')
var bcrypt = require('bcrypt')
var nodemailer = require('nodemailer')
var SALT_WORK_FACTOR = 10; 
var jwt = require('jsonwebtoken')

var user_schema = new mongoose.Schema({
	username : {type: String, unique: true},
	password : {type: String},
	email : {type: String, unique: true},
	branch : {type: String},
	bitsid : {type: String, unique: true},
	conf_key : {type: Number, default: 0},
	active : {type: Boolean, default:false},	
	admin_status : [{type : mongoose.Schema.ObjectId, ref : 'Project'}],
	//member status
	created_at : {type : Number},
	updated_at : {type : Number},
})

// Function will execute before saving the user object for hashing the password entered by the user. 
user_schema.pre('save', function(next) {
    var user = this;
    if (!user.isModified('password')) return next();
    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
             user.password = hash;
            next();
        });
    });
});

// Mail sending option - reusabel - for nodemailer.
var transporter = nodemailer.createTransport('smtps://netpproject%40gmail.com:iambatman1@smtp.gmail.com');
var send_confkey = function(user_email){
	// Generate a confirmation key everytime this function is called.
	var conf_key = Math.floor(Math.random()*90000) + 10000

	// setup e-mail data with unicode symbols
	var mailOptions = {
		from: "netpproject@gmail.com", // sender address
		to: user_email, // list of receivers
		subject: "Reg for ProSHare", // Subject line
		text: "Hello. Access key for " + user_email + " is " + conf_key, // plaintext body
	}
	
	// send mail with defined transport object
	transporter.sendMail(mailOptions, function(error, response){
		if(error){
			console.log(error);
		}else{
			console.log("Message sent: " + response.message);
		}
	});
	return conf_key
}

var send_pwd = function(user_email){
	// Generate a confirmation key everytime this function is called.
	var pwd = Math.floor(Math.random()*9000000) + 1000000

	// setup e-mail data with unicode symbols
	var mailOptions = {
		from: "netpproject@gmail.com", // sender address
		to: user_email, // list of receivers
		subject: "Reg for ProSHare", // Subject line
		text: "Hello. New password for " + user_email + " is " + pwd, // plaintext body
	}
	
	// send mail with defined transport object
	transporter.sendMail(mailOptions, function(error, response){
		if(error){
			console.log(error);
		}else{
			console.log("Message sent: " + response.message);
		}
	});
	return pwd
}


user_schema.methods.compare_password = function(candidatePassword, cb) {
		bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err, null);
        return cb(null, isMatch);
    });
};


//---------------------------//

// CRUD operation in user db

// Create new user - generate confirmation key and send mail.
user_schema.statics.create_user = function(user_info, callback){
	var bitsid = user_info.bitsid
	var email = "f" + bitsid.substring(0,4) + bitsid.substring(8,11) + "@goa.bits-pilani.ac.in"
	var new_user = new User({
		username : user_info.username,
		password : user_info.password,
		email : email,
		branch : user_info.branch,
		bitsid : user_info.bitsid,
		admin_status : [],
		conf_key : send_confkey(email),
		created_at : moment().unix(),
		updated_at : moment().unix()
	})
	new_user.save(function(err, user){
		if(err){
			callback(err, null)
			return
		}
		else if(user){
			callback(null, user)
			return
		}
	})
};

//check twice
user_schema.statics.compare_conf_key = function(request, bitsid, callback){
	var conf_key = request.conf_key
	User.findOne({"bitsid" : bitsid}, function(err, user){
		if(err) callback(new Error("Error in connection with database."), null)
		else if(!user) callback(new Error("User not found in db."), null)
		else{
			if(user.conf_key != conf_key){
				var conf_key_new = send_confkey(user.email)
				user.conf_key = conf_key_new
				user.save(function(err){
					if(err) callback(new Error("Error in connection with db"), null)
					callback(new Error("Incorrect confkey. New conf key sent to your email"), null)
				})
			} 
			else{
				user.active = true
				user.save(function(err){
					if(err) callback(new Error("Error in activating your profile."), null)
					callback(null, user)
				})
			}		
		}
	})
}

// user login
user_schema.statics.login = function(request, callback){
  User.findOne({"username": request.username}, function(err, user){
      if(err){
        return callback(new Error("Error in connection with db."), null)
      }
      else{
        if(!user){
          return callback(new Error("User not found in db."), null);
        }
        else{
          user.compare_password(request.password, function(err, isMatch){
            if(err){
              return callback(err, null);
			}
            else{
              if(isMatch){
				return callback(null, user)
              }
              else{
                return callback(new Error("Incorrect password"), null)
              }
            }
          });
        }
      }
     });
};

// forgot pwd
user_schema.statics.forgot_password = function(request,callback){
	User.findOne({"username": request.username}, function(err, user){
		if(err){
			return callback(err, null);
		}
		else{
			if(!user){
				return callback(new Error("User not found in db."), null)
			}
			else{
				var pwd = send_pwd(user.email);
				user.password = pwd;
				user.save(function(err, user){
					if(err){
						callback(err, null)
						return
					}
					else if(user){
						callback(null, user)
						return
					}
				});
			}
		}	
	});
};

// for convenience, keep entire mongoose user model in a variable named User.
var User = mongoose.model('User', user_schema)
module.exports = User
