This is to show what I done:

Flow:
User - Create new user & press worldcoin
Admin - Verify User (remix)
Charity - Create new charity
Charity - Create new project
Admin - Verify project (remix)
Admin - fund user wallet (metamask)
User - Donate project
Admin - fund quadratic pool (metamask)
Admin - check pool history (problem)
Admin - distribute fund
Charity - project get money
Charity - Create withdrawal proposal
Backend - AI evaluate and execute proposal


Day1:
Done sign in and sign up
Sign up can automatically create a wallet address and store in database

Day2:
Done refine sign in for admin and charity 
Can create new project
Donate working now for user admin
The funds are transferring correctly, but we're not recording them properly for quadratic funding calculations.

to fix error: QuadraticFundingPool: only platform can call

Day3:
Quadratic working fine
Can distribute and create new round

Day 4:
User wallet implemented transak
Charity admin can do proposal, but not calling backend
admin dashboard can call distribute and create new round

Day 5:
Charity can transfer money to any other crypto acc via proposal
If choose bank acc, will transfer to Account 1